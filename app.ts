import { randomUUID } from 'crypto'
import { config } from 'dotenv'
import { Telegraf } from 'telegraf'
import { InlineQueryResult, InlineQueryResultArticle, InputMessageContent } from 'telegraf/typings/core/types/typegram'
config()

interface IName {
    name: string
    weight: number
}

const bot = new Telegraf(process.env.TELEGRAM_TOKEN)
const names: Array<IName> = [
    {
        name: 'deadactive',
        weight: 1,
    },
    {
        name: 'NikitaKozlovR',
        weight: 1,
    },
    {
        name: 'newfox79',
        weight: 1,
    },
    {
        name: 'vldmrmatveev',
        weight: 1,
    },
]

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
            result.weight /= 2
            items.forEach(item => {
                if (item.name !== result.name) {
                    item.weight *= item.weight < 1 ? 2 : 1
                }
            })
            return result.name
        }
    }
}

bot.on('inline_query', async ctx => {
    const reviewer = choice(names, ctx.from.username)
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
        cache_time: 60,
    })
})

bot.launch()

console.log('BOT STARTED')

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))
