import jwt from "@elysiajs/jwt";
import type Elysia from "elysia";
import { t } from "elysia";
import { userSchema } from "../db/schema";

const jwtSchema = t.Object({
    user: userSchema,
    expiresAt: t.Number(),
});

export const authJwts = (app: Elysia) =>
    app
        .use(
            jwt({
                name: "accessTokenJwt",
                secret: Bun.env.ACCESS_TOKEN_SECRET,
                schema: jwtSchema,
            })
        )
        .use(
            jwt({
                name: "refreshTokenJwt",
                secret: Bun.env.REFRESH_TOKEN_SECRET,
                schema: jwtSchema,
            })
        );

