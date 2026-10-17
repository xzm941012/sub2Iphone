# SubWatch Web

Web 分支提供可独立部署的浏览器应用，保留额度、明细、调用详情、筛选、账户设置及主题；Web 导航只有「额度 / 明细 / 设置」。Android 源码、原生组件和设备预览运行时继续保留。

## 使用

初次打开使用虚构的演示账户。真实连接在设置中添加：服务地址须为管理员允许的公网 HTTPS 域名，输入管理员 API 密钥后验证并连接。默认允许 `sub2api.onemem.cc`、`sub2apicn.onemem.cc` 和 `sub2api-jp.onemem.cc`；部署者可用 `SUBWATCH_ALLOWED_HOSTS` 调整。

服务名称、地址、分组、显示账户与主题等偏好保存在本浏览器的 localStorage。管理员密钥仅保存在当前页面的内存中；关闭、刷新或结束页面会话后清除，重新连接需再次输入。用量缓存也只在内存中保存。密钥会经 HTTPS 传给本应用服务器，由其转发至所选服务；服务器不保存密钥、不记录请求正文，也不返回上游密钥或凭据字段。

网页仅在打开且可见时定时刷新。网页不提供 Android 原生桌面组件，也不依赖开发机、localhost 代理或 APPDATA 设置。演示分组、模型、用户、账户、密钥名称、时间范围、请求类型及计费筛选均作用于模拟记录；演示模式不会消费重置机会。

## 本地构建和验证

需要 Node.js 22.18+ 和 npm。构建产物运行时没有第三方依赖。

```sh
npm ci
npm run build
npm run test:web
node --experimental-strip-types --test tests/data.test.mjs tests/reset-flow.test.mjs tests/account-admin.test.mjs tests/appearance.test.mjs tests/preferences.test.mjs tests/web-server.test.mjs
npm run preview:web
```

访问 `http://127.0.0.1:4185/subwatch/`。Web 构建使用独立 `web.vite.config.ts`，不会更新或绕过设备预览的完整性锁。

## Oracle 部署

入口为 `https://sub2api-jp.onemem.cc/subwatch/`，沿用现有春川 NLB → 大阪 Nginx 的 HTTPS 路径。无需新增公网监听、DNS 或证书。将 `dist/` 作为一个完整版本上传至 `/usr/local/app/subwatch/releases/<release>/`，由 `current` 符号链接选择版本。

`deploy/subwatch-web.service` 用独立低权限用户运行 Node 服务，仅监听回环端口 4185。`deploy/subwatch.nginx.conf` 作为现有 HTTPS server 的独立 include。修改前保存当前配置快照，先验证 `nginx -t` 再 reload。回滚时将 `current` 指向上一版并重启独立服务；首装回滚可移除 include 并停止该服务，不改既有 Sub2API、代理、数据库及订阅配置。

上线检查包括服务 active、Nginx 配置、正式 HTTPS 页面与静态资源、生产接口的来源/域名约束、只读真实上游请求、错误日志和既有站点健康。真实凭据不得出现在源码、构建、上传包、截图或验证输出。

现有机器的实际 HTTP 配置为 `/etc/nginx/sites-enabled/sub2api-jp`（独立普通文件，并非 sites-available 的符号链接）；部署脚本以其解析后的路径为准。不能只改 sites-available 后把配置检查通过当作路由已经上线。

2026-10-17 已发布并验收：系统 DNS 与春川入口匹配，正式 HTTPS 页面、JS/CSS/图标及健康接口 200；4 项线上浏览器测试通过；真实服务的分组、账户列表和一条调用记录只读请求通过。既有主页/health 为 200，状态页未认证仍为 401，相关服务均 active。
