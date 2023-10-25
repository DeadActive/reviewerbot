import { randomUUID } from 'crypto'
import { config } from 'dotenv'
import { Telegraf } from 'telegraf'
import { InlineQueryResult, InlineQueryResultArticle, InputMessageContent } from 'telegraf/typings/core/types/typegram'
import { existsSync, readFile, writeFile } from 'fs'
import { appendFile } from 'fs/promises'
config()
class JSONDB {
    private filename: string

    public constructor(filename: string) {
        this.filename = filename
    }

    public async connect(): Promise<void> {
        if (!this.filename) return
        if (!existsSync(this.filename)) {
            await appendFile(this.filename, '{}')
        }
    }

    public fetch(): Promise<any> {
        if (!this.filename) return

        return new Promise<object>((resolve, reject) => {
            readFile(this.filename, (error, data) => {
                if (error) return reject(error)
                try {
                    resolve(JSON.parse(data.toString()))
                } catch {
                    reject()
                }
            })
        })
    }

    public commit(json: object): Promise<any> {
        if (!this.filename) return

        return new Promise<object>((resolve, reject) => {
            writeFile(this.filename, JSON.stringify(json), err => {
                if (err) return reject(err)
                resolve(json)
            })
        })
    }
}

interface IName {
    name: string
    weight: number
}

interface IAnswer extends InlineQueryResultArticle {
    name: string
}

function choice(items: Array<IName>, exclude: string) {
    const fItems = items.filter(item => item.name !== exclude)

    const cumulativeWeights = []

    fItems.forEach((name, i) => {
        cumulativeWeights[i] = name.weight + (cumulativeWeights[i - 1] || 0)
    })

    const maxWeight = cumulativeWeights[cumulativeWeights.length - 1]
    const random = maxWeight * Math.random()

    for (let i = 0; i < fItems.length; i += 1) {
        if (cumulativeWeights[i] >= random) {
            const result = fItems[i]
            return result.name
        }
    }
}

const buffer: Map<number, any[]> = new Map<number, any[]>()

function addAnswer(from: number, answer: IAnswer) {
    const result = buffer.get(from)

    if (result) {
        result.push(answer)
    } else {
        buffer.set(from, [answer])
    }
}

function getAnswer(from: number, id: string): IAnswer {
    return buffer.get(from)?.find(item => item.id === id)
}

function clearBuffer(from: number) {
    buffer.delete(from)
}

function isUserInvited(items, name) {
    return items.findIndex(item => item.name === name) !== -1
}

const db = new JSONDB('db.json')
db.connect().then(async () => {
    const dbData = await db.fetch()
    const names: Array<IName> = dbData.items

    const bot = new Telegraf(process.env.TELEGRAM_TOKEN)

    bot.use(async (ctx, next) => {
        if (!isUserInvited(names, ctx.from.username)) {
            return await ctx.reply('У мужлан нет прав')
        }

        await next()
    })

    function applyWeight(items, name) {
        const result = items.find(item => item.name === name)
        result.weight /= 2
        items.forEach(item => {
            if (item.name !== result.name) {
                item.weight *= item.weight < 1 ? 2 : 1
            }
        })

        db.commit({ items })
    }

    bot.on('inline_query', async ctx => {
        const reviewer = choice(names, ctx.from.username)
        const result: InlineQueryResultArticle = {
            type: 'article',
            id: randomUUID(),
            title: `@${reviewer}`,
            input_message_content: {
                message_text: `Ревьюер: @${reviewer}`,
                parse_mode: 'HTML',
            },
        }

        addAnswer(ctx.from.id, { ...result, name: reviewer })

        await ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, [result], {
            cache_time: 0,
        })
    })

    bot.on('chosen_inline_result', async ctx => {
        const result = getAnswer(ctx.from.id, ctx.chosenInlineResult.result_id)
        if (result) {
            applyWeight(names, result.name)
            clearBuffer(ctx.from.id)
        }
    })

    bot.command('add', async ctx => {
        const name = ctx.payload.trim()
        if (name.length === 0) {
            return await ctx.reply('Необходимо имя пользователя')
        }

        if (names.findIndex(item => item.name === name) !== -1) {
            return await ctx.reply('Такой тип уже есть')
        }

        names.push({
            name,
            weight: 1,
        })
        await db.commit({ items: names })
        await ctx.reply(`Ревьюер @${name} добавлен`, {
            parse_mode: 'HTML',
        })
    })

    bot.command('kick', async ctx => {
        const name = ctx.payload.trim()
        if (name.length === 0) {
            return await ctx.reply('Необходимо имя пользователя')
        }

        const itemIndex = names.findIndex(item => item.name === name)
        if (itemIndex !== -1) {
            names.splice(itemIndex, 1)
            await db.commit({ items: names })
            await ctx.reply(`Ревьюер @${name} убран`, {
                parse_mode: 'HTML',
            })
        } else {
            return await ctx.reply('Не нашли типа((')
        }
    })

    bot.command('karma', async ctx => {
        await ctx.reply(names.map(item => `@${item.name}: <b>${item.weight}</b>`).join('\n'), {
            parse_mode: 'HTML',
        })
    })

    bot.command('reset', async ctx => {
        names.forEach(item => {
            item.weight = 1
        })

        await db.commit({ items: names })
        await ctx.reply('Всем присвоена карма *1*', {
            parse_mode: 'Markdown',
        })
    })

    bot.launch()

    console.log('BOT STARTED')

    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'))
    process.once('SIGTERM', () => bot.stop('SIGTERM'))
})
