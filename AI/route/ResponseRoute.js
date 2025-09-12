import {response} from "../controller/Response.js";

export default async function responseRoute(fastify, options) {
    fastify.post('/response', {
        handler: response
    })
}
