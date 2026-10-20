export const CATALOG = [
  ['活着','余华','文学小说'],['许三观卖血记','余华','文学小说'],['文城','余华','文学小说'],['三体','刘慈欣','文学小说'],['三体Ⅱ：黑暗森林','刘慈欣','文学小说'],['三体Ⅲ：死神永生','刘慈欣','文学小说'],
  ['百年孤独','加西亚·马尔克斯','文学小说'],['霍乱时期的爱情','加西亚·马尔克斯','文学小说'],['小王子','安托万·德·圣埃克苏佩里','文学小说'],['悉达多','赫尔曼·黑塞','文学小说'],['平凡的世界','路遥','文学小说'],['红楼梦','曹雪芹','文学小说'],['围城','钱锺书','文学小说'],['局外人','阿尔贝·加缪','文学小说'],['追风筝的人','卡勒德·胡赛尼','文学小说'],['月亮与六便士','威廉·萨默塞特·毛姆','文学小说'],
  ['人类简史','尤瓦尔·赫拉利','历史传记'],['明朝那些事儿','当年明月','历史传记'],['万历十五年','黄仁宇','历史传记'],['苏东坡传','林语堂','历史传记'],['置身事内','兰小欢','经济商业'],['原则','瑞·达利欧','经济商业'],['穷查理宝典','查理·芒格','经济商业'],
  ['被讨厌的勇气','岸见一郎、古贺史健','心理成长'],['思考，快与慢','丹尼尔·卡尼曼','心理成长'],['蛤蟆先生去看心理医生','罗伯特·戴博德','心理成长'],['也许你该找个人聊聊','洛莉·戈特利布','心理成长'],['原子习惯','詹姆斯·克利尔','心理成长'],['认知觉醒','周岭','心理成长'],
  ['乡土中国','费孝通','社会科学'],['娱乐至死','尼尔·波兹曼','社会科学'],['第二性','西蒙娜·德·波伏瓦','社会科学'],['沉思录','马可·奥勒留','哲学思想'],['苏菲的世界','乔斯坦·贾德','哲学思想'],['时间简史','史蒂芬·霍金','科学技术'],['自私的基因','理查德·道金斯','科学技术'],['艺术的故事','贡布里希','艺术设计'],['瓦尔登湖','亨利·戴维·梭罗','文学小说'],['斯通纳','约翰·威廉斯','文学小说']
].map(([title,author,category])=>({title,author,category,source:'内置书目'}));
export function inferCategory(subjects=[]) {
  const s=subjects.join(' ').toLowerCase();
  const rules=[['历史传记',/history|biography|历史|传记/],['心理成长',/psychology|self.help|心理/],['经济商业',/economics|business|finance|经济|商业/],['哲学思想',/philosophy|哲学/],['科学技术',/science|technology|computer|科学|计算机/],['艺术设计',/art\b|design|艺术|设计/],['文学小说',/fiction|literature|poetry|novel|文学|小说/],['社会科学',/sociology|social|社会/]];
  return rules.find(([,re])=>re.test(s))?.[0]||'其他';
}
export async function searchRemote(query,signal) {
  const url=new URL('https://openlibrary.org/search.json');
  url.search=new URLSearchParams({title:query,limit:'6',fields:'key,title,author_name,subject'});
  const response=await fetch(url,{signal});
  if (!response.ok) throw new Error('在线书目暂时不可用');
  const result=await response.json();
  return (result.docs||[]).map(d=>({title:d.title,author:d.author_name?.join('、')||'',category:inferCategory(d.subject),source:'Open Library · 分类供参考'}));
}
