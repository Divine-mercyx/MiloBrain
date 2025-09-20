import {routerResponse} from "../controller/Response.js";
import {POST} from "../response/route.js";

export default async function responseRoute(fastify) {
    fastify.post('/response', {
        handler: POST
    })
    fastify.post('/router', {
        handler: routerResponse
    })
}
