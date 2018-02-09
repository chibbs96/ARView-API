import { neo4jgraphql } from "./executor";
import driver from "./server";
import { makeError } from "graphql-errors";

// const { maskErrors } = require('graphql-errors');

require("./server");

const resolvers = {
    Query: {
        userById(object, args, ctx, resolveInfo) {
            return neo4jgraphql(object, args, ctx, resolveInfo);
        },
        allUsers(object, args, ctx, resolveInfo) {
            return neo4jgraphql(object, args, ctx, resolveInfo);
        },
        tagById(object, args, ctx, resolveInfo) {
            let matcher = `id(tag) = ${args.id}`;
            return neo4jgraphql(object, args, ctx, resolveInfo, matcher);
        },
        tagsByUserId(object, args, ctx, resolveInfo) {
            return neo4jgraphql(object, args, ctx, resolveInfo);
        },
        tagsByLocation(object, args, ctx, resolveInfo) {
            let minLat = args.lat - args.radius;
            let maxLat = args.lat + args.radius;
            let minLon = args.lon - args.radius;
            let maxLon = args.lon + args.radius;
            let matcher = `${minLat} < tag.lat AND tag.lat < ${maxLat}
                       AND ${minLon} < tag.lon AND tag.lon < ${maxLon}`;
            return neo4jgraphql(object, args, ctx, resolveInfo, matcher);
        }
    },
    Mutation: {
        createUser(object, args, ctx, resolveInfo) {
            console.log("Creating a user");
            console.log(args.userId);

            return neo4jgraphql(object, args, ctx, resolveInfo).then(existingUser => {
                if(!existingUser) {
                    console.log("The user did not exist");
                    let params = {
                        userId: args.userId
                    };

                    let query = `CREATE (user:User { userId: $userId, name: $userId }) RETURN user`;

                    return driver.session().run(query, params).then(result => {
                       return result.records[0].get('user').properties;
                    });

                } else {
                    console.log("The user already exists in the system");
                    throw new Error("A user with that userId already exists");
                }
            })


        },
        createTag(object, args, ctx, resolveInfo) {
            console.log("Creating a tag");
            console.log(args);

            let query = `
                CREATE (tag:Tag {
                    userId: $userId, 
                    title: $title, 
                    text: $text, 
                    lat: $lat, 
                    lon: $lon, 
                    ele: $ele, 
                    dtg: $dtg 
                })
                WITH tag
                MATCH (user:User) WHERE user.userId = "${args.userId}"
                WITH tag, user
                CREATE (user)-[:TAGGED]->(tag)
                CREATE (tag)-[:TAGGED_BY]->(user)
                RETURN tag
            `;

            return driver.session().run(query, args).then(result => {
                return neo4jgraphql(object, args, ctx, resolveInfo, undefined);
            });
        },
        removeTag(object, args, ctx, resolveInfo) {
            console.log("Removing a tag");
            console.log(args);

            let query = `
                MATCH (tag:Tag)
                WHERE id(tag) = ${args.id}
                DETACH DELETE tag
            `;

            return driver.session().run(query, args).then(result => {
                let matcher = `id(tag) = ${args.id}`;
                return neo4jgraphql(object, args, ctx, resolveInfo, matcher);
            })
        }
    }
};

export default resolvers;