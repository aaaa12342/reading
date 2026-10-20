# reading · 阅读手账

无构建静态网页，可部署到 GitHub Pages。本地记录与 Supabase 云记录分开保存。每次阅读单独记起止日期，按读完月份统计；书架汇总读完次数。

## 本地使用

在此目录运行 `python -m http.server 8080 --bind 127.0.0.1`，浏览器打开 http://127.0.0.1:8080 。不要直接双击 HTML（ES 模块需要 HTTP）。未登录时存储在当前浏览器，清理浏览器数据会丢失，请导出 JSON 备份。示例数据必须主动载入，不会自动混入真实记录。

## Supabase 初始化

1. 创建 Supabase 项目，在 SQL Editor 中完整运行 [supabase/schema.sql](supabase/schema.sql)。该脚本创建两张表、权限规则和事务函数，不会清空既有数据。若项目已经有同名表，应先检查结构是否兼容。
2. 在项目 Connect / API Keys 或 Settings 的 Data API 中取得 Project URL 与 Publishable key（旧版 anon key）。只用公开连接 key，绝不能使用 secret、service_role 或数据库密码。
3. 填入根目录 `config.js`，或打开网页“同步与备份”保存连接信息。根配置随网页发布后各设备共用；设置面板配置只保存在当前浏览器。
4. Authentication → URL Configuration 中，将 Site URL 设为 GitHub Pages 地址，并把同一地址加入 Redirect URLs。地址需包含仓库子路径和末尾 `/`。
5. 在网页中注册阅读账号，查收邮件确认后登录。Supabase 控制台登录账号与网页的阅读账号是两套账号。
6. 如为自己独用，可在完成网页账号注册后关闭 Authentication 中 Allow new users to sign up。其他账号即使注册也只能访问自己的记录。

表的 RLS 只允许当前用户读写自己的记录；复合外键确保阅读记录只能引用本人的图书。日期由浏览器本地日历计算，服务器限制未来日期时使用北京时间。开始和读完日期均计入用时，同日读完为 1 天。

本地记录迁移到云端：未登录时导出 JSON → 登录 → 导入备份。导入追加，不会覆盖同名书的既有分类；完全相同的阅读记录会跳过，ID 内容冲突会取消导入。云导入为一个数据库事务。导出包含私人阅读笔记，请自行妥善保存。

## GitHub Pages

将静态项目推送到目标仓库，Settings → Pages → Deploy from a branch → main / root。所有资源使用相对路径，支持 `https://用户名.github.io/reading/`。有 `.nojekyll`，不需要安装依赖或构建步骤。公开仓库只提交网页、SQL 和公开连接信息，阅读记录保存在 Supabase，不写入仓库。

## 书籍信息

输入书名时先匹配已有书架与内置常见书目，没有结果则检索 Open Library。在线请求有超时与取消机制，匹配失败可手工输入。在线分类根据 subject 推断，供参考，用户始终可以修改。中文书目覆盖不完整，不保证每本都能查到。分类按书籍保存，修改后该书的历次记录统计都会采用新分类。同名同作者视为同一本书；不同译本如需分开，请在书名中标明版本。

## 校验与验收

`node --test tests/*.test.js` 运行领域测试。浏览器验证脚本使用环境中已安装的 Playwright：`node tests/browser.mjs`（需设置 PLAYWRIGHT_MODULE 指向 playwright 的 index.mjs，并调整本机 Edge 路径）。浏览器测试用本地文件拦截路由提供静态资源，验证界面与本地存储流程，不能代替真实部署或云端验收。

真实云端验收：同账号在两种浏览器添加/刷新/编辑记录；另一个账号不能读取或更改首个账号数据；未登录不能读云表；跨月/跨年和重读归档正确；网络中断时表单保留并报错。免费项目可能因不活跃暂停，恢复后再刷新。没有连接真实项目之前，本地测试不代表云同步或权限已验证。
