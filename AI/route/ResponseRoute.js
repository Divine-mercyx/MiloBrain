// import {response, routerResponse} from "../controller/Response.js";
import {POST} from "../response/route.js";

export default async function responseRoute(fastify, options) {
    fastify.post('/response', {
        handler: POST
    })
    fastify.post('/router', {
        handler: routerResponse
    })
}
