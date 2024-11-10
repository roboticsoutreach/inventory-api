import Elysia from "elysia";
import { log } from "./util/log";

const PORT = Bun.env.PORT ? parseInt(Bun.env.PORT) : 3000;

function startApi() {
    new Elysia().get("/", () => "Hello world").listen(PORT);

    log.info(`API started on port ${PORT}`);
}

startApi();

