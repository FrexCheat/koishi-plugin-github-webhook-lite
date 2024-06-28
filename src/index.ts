import crypto from 'crypto'
import { getGithubRegURL } from './regex'
import { Context, Schema, Element, h } from 'koishi'
import { } from '@koishijs/plugin-server'
import { } from '@koishijs/plugin-database-sqlite'

export const name = 'github-webhook'
export const inject = { required: ['database', 'server'], }

export interface Config {
  secret: string
  path: string
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

export const Config: Schema<Config> = Schema.object({
  secret: Schema.string().required().description('输入Github Webhook secret'),
  path: Schema.string().default('/github/webhook').required().description('输入Github Webhook路由路径'),
})

function sendEventMessage(ctx: Context, groupArray: Array<Webhook>, msgElement: Element[]) {
  ctx.bots.forEach(botObj => {
    groupArray.forEach(group => {
      try {
        if (group.platform.toLowerCase() === botObj.platform.toLowerCase()) {
          ctx.bots[`${botObj.platform}:${botObj.selfId}`].sendMessage(`${group.id}`, msgElement)
        }
      }
      catch (e) {
        ctx.logger('webhook-lite').error(e)
      }
    })
  })
}

export function apply(ctx: Context, config: Config) {
  ctx.model.extend('webhook', { id: 'string', platform: 'string' })

  ctx.command('wh-sub', '订阅Github事件推送')
    .action(async ({ session }) => {
      const groupId = session.guildId
      const platform = session.platform
      if (groupId) {
        try {
          await ctx.database.upsert('webhook', (row) => [{ id: groupId, platform: platform }])
          session.send('本群订阅成功')
        }
        catch (e) {
          session.send('数据插入失败！')
          ctx.logger('webhook-lite').error(e)
        }
      }
      else {
        session.send('本插件仅限群聊使用！')
      }
    })

  ctx.command('wh-unsub', '取消Github事件推送')
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
    const repoUrl = repo['html_url']
    if (event === 'star') {
      if (payload.action === 'created') {
        const content = `用户 -${sender['login']}- [star]仓库 -${repo['full_name']}- (共计 ${star} 个star)`
        const regUrl = getGithubRegURL(repoUrl)
        const hash = crypto.createHash('sha256').update(new Date().toString()).digest('hex').slice(0, 8)
        const imgURL = { src: 'https://opengraph.githubassets.com/' + hash + regUrl }
        const msgChain = [h('message', content, h('img', imgURL))] as Element[]
        sendEventMessage(ctx, query, msgChain)
      }
      if (payload.action === 'deleted') {
        const content = `用户 -${sender['login']}- [unstar]仓库 -${repo['full_name']}- (剩余 ${star} 个star)`
        const regUrl = getGithubRegURL(repoUrl)
        const hash = crypto.createHash('sha256').update(new Date().toString()).digest('hex').slice(0, 8)
        const imgURL = { src: 'https://opengraph.githubassets.com/' + hash + regUrl }
        const msgChain = [h('message', content, h('img', imgURL))] as Element[]
        sendEventMessage(ctx, query, msgChain)
      }
    }
    if (event === 'push') {
      const pusher = payload.pusher
      const commits = payload.commits as Array<any>
      const imgElements = [] as Element[]
      let content = `用户 -${pusher['name']}- [push]仓库 -${repo['full_name']}- (共计 ${star} 个star)：\n`
      commits.forEach(comObject => {
        content = content.concat("-- " + comObject['message'] + "\n")
        const imgHash = crypto.createHash('sha256').update(comObject['id']).digest('hex').slice(0, 8)
        const urlRes = 'https://opengraph.githubassets.com/' + imgHash + getGithubRegURL(comObject['url'])
        imgElements.push(h('img', { src: urlRes }))
      })
      content = content.concat(`详细内容：${payload.compare}`)
      const msgChain = [h('message', content, imgElements)] as Element[]
      sendEventMessage(ctx, query, msgChain)
    }
    if (event === 'workflow_run') {
      if (payload.action === 'completed') {
        const workDetial = payload.workflow_run
        let content = `用户 -${sender['login']}- 发起仓库 -${repo['full_name']}- 的 Action：\n`
        content = content.concat(`发起事件: [${workDetial.event}]\n`)
        content = content.concat(`Action名称: [${workDetial.name}]\n`)
        content = content.concat(`Action结果: [${workDetial.conclusion}]\n`)
        content = content.concat(`相关Commit: [ ${workDetial.display_title} ]\n`)
        content = content.concat(`详细内容：${workDetial.html_url}`)
        const msgChain = [h('message', content)] as Element[]
        sendEventMessage(ctx, query, msgChain)
      }
    }
    res.status = 200
    res.body = 'Webhook received'
  })
}
