# SubWatch Web

Web 分支提供可独立部署的浏览器应用，保留额度、明细、调用详情、筛选、账户设置及主题；Web 导航只有「额度 / 明细 / 设置」。Android 源码、原生组件和设备预览运行时继续保留。

已合并主分支 `a68b970`：调用明细支持可开关的每 10 秒增量刷新、下拉刷新、保留分页历史和阅读位置、插入动画，以及请求类型、Fast 和首字延迟颜色。原手机预览独立放在开发入口 `/preview.html`，主入口继续提供 Web 应用；两者回归测试分别验证。

## 使用

初次打开使用虚构的演示账户。真实连接在设置中添加：服务地址须为管理员允许的公网 HTTPS 域名，输入管理员 API 密钥后验证并连接。默认允许 `sub2api.onemem.cc`、`sub2apicn.onemem.cc` 和 `sub2api-jp.onemem.cc`；部署者可用 `SUBWATCH_ALLOWED_HOSTS` 调整。

服务名称、地址、分组、显示账户与主题等偏好保存在本浏览器的 localStorage。「在此浏览器记住密钥」默认开启，密钥保存在独立的本地存储条目 `subwatch.web.keys.v1`，刷新、关闭或重新打开后自动恢复真实连接；与连接的服务地址绑定，修改地址需重新输入密钥。关闭该选项后，保存会移除该连接的持久密钥，只在当前页面内存中保留；设置中的「清除本浏览器的所有密钥」会同时清除持久和内存密钥，保留地址与偏好。移除连接也会清除其密钥。本地存储不加密，同源页面脚本或有权限的扩展可访问，不跨浏览器或设备同步；清除站点数据会删除保存内容，无痕模式通常只保留到关闭窗口。用量缓存仍只在内存中保存。密钥经 HTTPS 传给本应用服务器转发到所选服务；服务器不保存密钥、不记录请求正文，也不返回上游密钥或凭据字段。

网页仅在打开且可见时定时刷新。网页不提供 Android 原生桌面组件，也不依赖开发机、localhost 代理或 APPDATA 设置。演示分组、模型、用户、账户、密钥名称、时间范围、请求类型及计费筛选均作用于模拟记录；演示模式不会消费重置机会。

Web 构建明确以 Safari / iOS 16.2 为兼容目标。Vite 默认目标较新，会将 `max-width` 条件压缩为 Safari 16.4 才支持的媒体查询范围语法，导致 iOS 16.2 忽略手机布局并显示桌面侧栏；不要移除 `web.vite.config.ts` 中的 JS/CSS 目标。回归检查直接读取发布后的 CSS，拒绝媒体查询比较符，并验证手机横竖屏下主内容和三个导航按钮均在屏幕内。可通过 `SUBWATCH_TEST_BROWSER=webkit` 运行同一套 WebKit 回归；自动化使用当前 WebKit，并非 iOS 16.2 真机。

## 账号状态

额度页在账号名右侧箭头旁展示 Sub2API 主状态标签。正常状态仅展示，其他状态点击后显示当前原因、预计恢复时间（如有）和重置确认框。确认后使用 `/admin/accounts/:id/clear-error` 清理错误、限流、过载和临时调度阻塞；与消耗次数的额度重置操作分开，不增加额度、不改变手动调度开关。响应未确认时显示待核实提示，不自动重试。仅为 Web 添加此入口，Android 原有界面保持不变。

状态字段经服务端白名单投影，不返回原始凭据、代理或额外账号配置。账号额度接口失败时仅沿用已缓存的额度，状态与调度信息仍使用本次账号列表的数据。

## 本地构建和验证

需要 Node.js 22.18+ 和 npm。构建产物运行时没有第三方依赖。

```sh
npm ci
npm run build
npm run test:web
node --experimental-strip-types --test tests/data.test.mjs tests/reset-flow.test.mjs tests/account-admin.test.mjs tests/account-status.test.mjs tests/appearance.test.mjs tests/preferences.test.mjs tests/web-server.test.mjs
npm run preview:web
```

访问 `http://127.0.0.1:4185/subwatch/`。Web 构建使用独立 `web.vite.config.ts`，不会更新或绕过设备预览的完整性锁。

## Oracle 部署

入口为 `https://sub2api-jp.onemem.cc/subwatch/`，沿用现有春川 NLB → 大阪 Nginx 的 HTTPS 路径。无需新增公网监听、DNS 或证书。将 `dist/` 作为一个完整版本上传至 `/usr/local/app/subwatch/releases/<release>/`，由 `current` 符号链接选择版本。

已有安装的应用更新使用 `python deploy/update-oracle.py`：只上传构建产物、切换版本并重启 SubWatch；校验现有 Nginx 与 systemd 配置的哈希不变，保存上一版本索引，健康检查失败时自动切回。首次安装才使用原 `deploy/deploy-oracle.py`。

`deploy/subwatch-web.service` 用独立低权限用户运行 Node 服务，仅监听回环端口 4185。`deploy/subwatch.nginx.conf` 作为现有 HTTPS server 的独立 include。修改前保存当前配置快照，先验证 `nginx -t` 再 reload。回滚时将 `current` 指向上一版并重启独立服务；首装回滚可移除 include 并停止该服务，不改既有 Sub2API、代理、数据库及订阅配置。

上线检查包括服务 active、Nginx 配置、正式 HTTPS 页面与静态资源、生产接口的来源/域名约束、只读真实上游请求、错误日志和既有站点健康。真实凭据不得出现在源码、构建、上传包、截图或验证输出。

现有机器的实际 HTTP 配置为 `/etc/nginx/sites-enabled/sub2api-jp`（独立普通文件，并非 sites-available 的符号链接）；部署脚本以其解析后的路径为准。不能只改 sites-available 后把配置检查通过当作路由已经上线。

2026-10-17 已发布并验收：系统 DNS 与春川入口匹配，正式 HTTPS 页面、JS/CSS/图标及健康接口 200；持久化更新通过 9 项本地与线上浏览器测试、3 项原有连接流程回归；真实服务的分组、账户列表和一条调用记录只读请求已通过，本次再次验证分组查询。既有主页/health 为 200，状态页未认证仍为 401，相关服务均 active。

2026-10-18 账号状态版本 `20261018T050128Z` 已更新：构建、36 项单元测试、16 项 Chromium / 16 项 WebKit 网页回归、36 项原手机运行时回归通过；正式入口的 16 项 WebKit 回归再次通过。真实账号只读返回状态字段，SubWatch 与既有服务 active，最近十分钟无 SubWatch 错误日志。未对真实账号提交状态重置，也未消费额度重置次数；取消、确认、重复点击、失败、调度暂停及额度读取失败均使用模拟接口验证。
