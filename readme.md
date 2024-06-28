# koishi-plugin-github-webhook-lite

[![npm](https://img.shields.io/npm/v/koishi-plugin-github-webhook-lite?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-github-webhook-lite)

基于koishi-server服务的GitHub Webhook事件监听订阅插件

目前已经支持的事件：**star、push、action**

后续计划支持的事件：**pull_requests、issues**

近期计划实现的功能：多仓库订阅

## 更新日志

`V1.0.7`：修复了因配置约束导致koishi崩溃的问题

`V1.0.6`：修复了因 `broadcast` 函数的数据库服务导致消息无法发送的问题

`V1.0.5`：加入了Github OpenGraph图片支持

`V1.0.4`：增加了对工作流事件的监视

## 如何使用

### 一、设置插件选项

#### secret

此选项你可以认为是之后 Github 仓库与你的事件接收端的通信密钥，设置为你能记住的字符串即可。

#### path

此选项一般保持默认值即可，如果要更改必须保证至少为两层路径。

### 二、创建仓库Webhook

进入仓库主页 —— 点击仓库的 **“Settings”** 选项 —— 在左侧的选项栏里找到 **“Webhooks”** —— 点击右上角的 **“Add webhook”** 按钮

### 三、配置仓库Webhook

#### Payload URL

这个选项是 Github 仓库事件发送的目标URL，也即之后这个仓库的相关事件的数据都会发送到这个URL上。

由于本插件是基于koishi-server组件的，所以 URL 的主机名也就是你部署的 Koishi 的主机名。

一般为 `http://你部署koishi的ip:端口/github/webhook` ，其中 `/github/webhook` 就是插件中 `path` 配置项的内容。

如果你的koishi服务端设置了域名访问，请在服务器上配置 **反向代理** ，将此路径代理到相应的koishi端口上。

#### Content type

这个选项请一定要选择为 `application/json` ，另外一个选项会导致插件无法正常工作。

#### Secret

请与插件配置中你所填写的 `secret` 保持一致！

### 四、效果测试

检查完以上所有配置没有错误后，点击下面的 **Add webhook** 按钮完成创建。

在你的机器人平台上，找到一个群，发送 `/wh-sub` 即可在本群订阅到仓库的事件通知；发送 `/wh-unsub` 可以取消在本群的订阅通知。

![star](https://raw.githubusercontent.com/FrexCheat/koishi-plugin-github-webhook-lite/master/img/star.png)

![push](https://raw.githubusercontent.com/FrexCheat/koishi-plugin-github-webhook-lite/master/img/push.png)

![action](https://raw.githubusercontent.com/FrexCheat/koishi-plugin-github-webhook-lite/master/img/action.png)