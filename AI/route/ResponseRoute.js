import {response, routerResponse} from "../controller/Response.js";

export default async function responseRoute(fastify, options) {
    fastify.post('/response', {
        handler: response
    })
    fastify.post('/router', {
        handler: routerResponse
    })
}
