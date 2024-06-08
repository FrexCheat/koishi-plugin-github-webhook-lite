import { Context, Schema, Bot } from 'koishi'
import { } from '@koishijs/plugin-server'
import { } from '@koishijs/plugin-database-sqlite'
import crypto from 'crypto'

export const name = 'github-webhook'
export const inject = {
  required: ['database', 'server'],
}
export interface mBot {
  // QQ群机器人
  qqBot: Bot<Context>
  // QQ频道机器人
  qqguildBot: Bot<Context>
  // OneBot机器人
  oneBot: Bot<Context>
  // Red机器人
  redBot: Bot<Context>
  // Telegram机器人
  telegramBot: Bot<Context>
  // Satori机器人
  satoriBot: Bot<Context>
  // Chronocat机器人
  chronocatBot: Bot<Context>
  // sandbox
  sandboxBot: Bot<Context>
}
export interface Webhook {
  id: string
  platform: string
}
declare module 'koishi' {
  interface Tables {
    webhook: Webhook
  }
}
export interface Config {
  secret: string
  path: string
}
export const Config: Schema<Config> = Schema.object({
  secret: Schema.string().required().description('输入你的Github Webhook secret'),
  path: Schema.string().default('/webhook').description('输入你的Github Webhook payload路由路径'),
})

function sendEventMessage(_ctx: Context, groupArray: Array<Webhook>, content: string) {
  groupArray.forEach(obj => {
    try {
      _ctx.broadcast([`${obj.platform}:${obj.id}`], content)
    }
    catch (e) {
      _ctx.logger('webhook-lite').warn(e)
    }
  })
}

export function apply(ctx: Context, config: Config) {
  ctx.model.extend('webhook', {
    id: 'string',
    platform: 'string',
  })

  const parentCmd = ctx.command('githubwh')
  parentCmd.subcommand('wh-sub')
    .action(async ({ session }) => {
      const groupId = session.guildId
      const platform = session.platform
      if (groupId) {
        await ctx.database.upsert('webhook', (row) => [
          { id: groupId, platform: platform },
        ])
        session.send('本群订阅成功')
      }
      else {
        session.send('本插件仅限群聊使用！')
      }
    })
  parentCmd.subcommand('wh-unsub')
    .action(async ({ session }) => {
      const groupId = session.guildId
      if (groupId) {
        const query = await ctx.database.get('webhook', groupId) as Array<Webhook>
        if (query.length === 0) {
          session.send('本群暂未订阅仓库事件！')
        }
        else {
          await ctx.database.remove('webhook', [groupId])
          session.send('本群仓库订阅已取消！')
        }
      }
      else {
        session.send('本插件仅限群聊使用！')
      }
    })

  ctx.server.post(config.path, async (res) => {
    const payload = res.request.body
    const event = res.headers['x-github-event'] as string
    const signature = res.headers['x-hub-signature-256'] as string
    const hmac = crypto.createHmac('sha256', config.secret)
    const digest = 'sha256=' + hmac.update(JSON.stringify(payload)).digest('hex')
    if (signature !== digest) {
      res.status = 403
      res.body = 'Forbidden'
      return
    }
    const repo = payload.repository
    const sender = payload.sender
    const star = repo.stargazers_count
    if (event === 'star') {
      if (payload.action === 'created') {
        const content = `用户 -${sender['login']}- star 仓库 -${repo['full_name']}- (共计 ${star} 个star)`
        const query = await ctx.database.get('webhook', {}) as Array<Webhook>
        sendEventMessage(ctx, query, content)
      }
      if (payload.action === 'deleted') {
        const content = `用户 -${sender['login']}- unstar 仓库 -${repo['full_name']}- (剩余 ${star} 个star)`
        const query = await ctx.database.get('webhook', {}) as Array<Webhook>
        sendEventMessage(ctx, query, content)
      }
    }

    res.status = 200
    res.body = 'Webhook received'
  })
}
