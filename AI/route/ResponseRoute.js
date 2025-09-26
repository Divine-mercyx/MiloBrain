import {routerResponse} from "../controller/Response.js";
import {POST} from "../response/route.js";
import {transcribe} from "../response/transcribeRouter.js";

export default async function responseRoute(fastify) {
    fastify.post('/response', {
        handler: POST
    })
    fastify.post('/router', {
        handler: routerResponse
    })
    fastify.post('/transcribe', {
        handler: transcribe
    })
}
