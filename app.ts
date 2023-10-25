import { randomUUID } from 'crypto'
import { config } from 'dotenv'
import { Telegraf } from 'telegraf'
import { InlineQueryResult, InlineQueryResultArticle, InputMessageContent } from 'telegraf/typings/core/types/typegram'
config()

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
const names: Array<string> = ['deadactive', 'NikitaKozlovR', 'newfox79', 'vldmrmatveev']

function pick(array: Array<string>, exclude: string) {
    const fArray = array.filter(name => name !== exclude)
    return `@${fArray[Math.floor(Math.random() * fArray.length)]}`
}

bot.on('inline_query', async ctx => {
    const reviewer = pick(names, ctx.from.username)
    const result: InlineQueryResultArticle = {
        type: 'article',
        id: randomUUID(),
        title: reviewer,
        input_message_content: {
            message_text: `Ревьюер: ${reviewer}`,
            parse_mode: 'Markdown',
        },
    }

    console.log(result)
    await ctx.telegram.answerInlineQuery(ctx.inlineQuery.id, [result], {
        cache_time: 0,
    })
})

bot.launch()

console.log('BOT STARTED')

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
