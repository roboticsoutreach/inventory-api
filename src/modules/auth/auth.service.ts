import { eq } from "drizzle-orm";
import { db } from "../../db";
import { users } from "../../db/schema";

export namespace AuthService {
    export async function login(username: string, password: string) {
        const user = await db.query.users.findFirst({
            where: eq(users.username, username),
        });
    }
}

