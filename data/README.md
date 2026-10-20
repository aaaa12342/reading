# 中文书目数据

`catalog-zh.json` 为 Wikidata 开放结构化元数据快照（CC0），含中文书名、作者、类型建议和来源实体编号；不包含书籍正文、封面或内容简介。快照中的 `query` 保存了生成查询，`updated_on` 保存了更新日期。

生成方式：在项目根目录运行 `python scripts/build_catalog.py`。只在手动执行时更新，不会在用户每次打开页面时全量抓取。接口错误或返回异常小的数据集时保留原快照。可使用 `--from-raw` 从已下载的原始响应继续补全作者。原始响应不进入 Git。

快照是有中文标签、作者与一定维基百科覆盖的部分书目，不是完整出版目录，也不代表推荐排名。中文常用书和部分译名在 `js/catalog-seed.js` 中补充。书名、作者等元数据可能有版本差异，分类仅供参考，用户可在表单中修改；已有个人书籍的作者和分类优先。

来源与许可：https://www.wikidata.org/wiki/Wikidata:Licensing

《紫颜色》两版 ISBN、作者与书名核对来源：
- 对外经济贸易大学图书馆：https://opac.lib.uibe.edu.cn/opac/book/e3f1480357aaf519224c34a1bdea1d9d
- 深圳图书馆 OPAC：https://ilas.szclib.org.cn/ILASOPAC/

在线补充：Wikidata Action API 与 Open Library Search API。两者均使用公开只读接口；请求有防抖、取消和独立超时。不使用需要额外密钥的商业接口。
