import chalk from "chalk";

function createLogger(prefix: string) {
    return (...args: any[]) => {
        console.log(chalk.magenta("[inventory-api]"), prefix, ...args);
    };
}

export const log = {
    info: createLogger(chalk.blue("[info]")),
    warn: createLogger(chalk.yellow("[warn]")),
    error: createLogger(chalk.red("[error]")),
};

