import { Context, Schema, Bot } from 'koishi'
import { } from '@koishijs/plugin-server'
import { } from '@koishijs/plugin-database-sqlite'
import crypto from 'crypto'

export const name = 'github-webhook'
export const inject = {
  required: ['database', 'server'],
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
    const query = await ctx.database.get('webhook', {}) as Array<Webhook>
    const repo = payload.repository
    const sender = payload.sender
    const star = repo.stargazers_count
    if (event === 'star') {
      if (payload.action === 'created') {
        const content = `用户 -${sender['login']}- [star]仓库 -${repo['full_name']}- (共计 ${star} 个star)`
        sendEventMessage(ctx, query, content)
      }
      if (payload.action === 'deleted') {
        const content = `用户 -${sender['login']}- [unstar]仓库 -${repo['full_name']}- (剩余 ${star} 个star)`
        sendEventMessage(ctx, query, content)
      }
    }
    if (event === 'push') {
      const pusher = payload.pusher
      const commits = payload.commits as Array<any>
      let content = `用户 -${pusher['name']}- [push]仓库 -${repo['full_name']}- (共计 ${star} 个star)：\n`
      commits.forEach(comObject => { content = content.concat("-- " + comObject['message'] + "\n") })
      content = content.concat(`详细内容：${payload.compare}`)
      sendEventMessage(ctx, query, content)
    }
    if (event === 'workflow_run') {
      if (payload.action === 'completed') {
        const workDetial = payload.workflow_run
        let content = `用户 -${sender['login']}- 发起仓库 -${repo['full_name']}- 的 Action：\n`
        content = content.concat(`发起事件: [${workDetial.event}]\n`)
        content = content.concat(`Action名称: [${workDetial.name}]\n`)
        content = content.concat(`Action结果: [${workDetial.conclusion}]\n`)
        content = content.concat(`相关Commits: [${workDetial.display_title}]\n`)
        content = content.concat(`详细内容：[${workDetial.html_url}]`)
        sendEventMessage(ctx, query, content)
      }
    }
    res.status = 200
    res.body = 'Webhook received'
  })
}
