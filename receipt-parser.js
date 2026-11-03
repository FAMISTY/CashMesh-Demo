/* Shared local receipt parsing. Amounts are decimal strings; no remote service. */
(function(root){'use strict';
function normalize(text){return String(text||'').normalize('NFKC').replace(/[\u200b-\u200d\ufeff]/g,'').replace(/(?<=[\u3400-\u9fff])[^\S\n]+(?=[\u3400-\u9fff])/g,'').replace(/[−—–]/g,'-');}
function moneyTokens(text){
 const out=[],re=/(?<sign>[+-]?)\s*(?:[¥￥Ұ]|RMB|CNY|人民币|[·•・‧∙⋅｡。](?=\s*\d)|\.(?=\s*\d+\.))\s*(?<after>[+-]?)\s*(?<num>\d[\d,，]*(?:\s*[.．]\s*\d{1,2})?)/gi;
 for(const m of text.matchAll(re)){const n=Number(m.groups.num.replace(/[\s,，]/g,''));if(Number.isFinite(n)&&n<1e9)out.push({value:n,negative:m.groups.sign==='-'||m.groups.after==='-',index:m.index,raw:m[0]});}
 // iOS sometimes drops the currency symbol altogether. Only standalone decimal lines qualify.
 for(const m of text.matchAll(/^\s*([+-]?)\s*(\d[\d,]*(?:\s*\.\s*\d{1,2}))\s*(?:元)?\s*$/gm)){if(!out.some(x=>Math.abs(x.index-m.index)<m[0].length))out.push({value:Number(m[2].replace(/[\s,]/g,'')),negative:m[1]==='-',index:m.index,raw:m[0]});}
 return out.sort((a,b)=>a.index-b.index);
}
function parse(raw){const text=normalize(raw),flat=text.replace(/\s/g,''),warnings=[],evidence=[];
 const payment=(flat.match(/(?:支付方式|付款方式|支付渠道)[:：]?([^>›]{0,20})/)||[])[1]||'';
 let platform=(flat.match(/美团月付|抖音月付|花呗|白条|信用卡/)||[])[0]||'';
 if(!platform&&/[^\d\s]音月付/.test(payment)){platform='抖音月付';evidence.push('支付方式中的“×音月付”按抖音月付纠错，请核对');}
 if(!platform)platform=(flat.match(/小红书|微信|支付宝|抖音|美团|京东|淘宝|银行卡|现金/)||[])[0]||'其他';
 const deferred=/确认收货后付|收货后付款|先用后付|先享后付/.test(flat),credit=deferred||/月付|花呗|白条|信用卡/.test(platform);
 let kind=/提现|转出到|转入到|账户划转|余额转入|余额转出/.test(flat)?'transfer':/还款成功|已还款|还款完成/.test(flat)?'repayment':/退款成功|已退款|退款完成/.test(flat)?'refund':/本期账单|本期应还|账单金额|待还总额/.test(flat)?'statement':/收入|到账|收款成功|工资|红包已领取/.test(flat)?'income':deferred||/支付成功|付款成功|交易成功|消费|付款时间|支付时间|实付|订单金额/.test(flat)?'expense':'';
 if(/订单已取消|交易关闭|待付款|等待付款|提现失败|提现处理中/.test(flat)){kind='';warnings.push('交易未完成或状态不明，请核对后选择类型');}
 const settlement=credit?'credit':'cash';
 let destination=(flat.match(/(?:提现到|转入到|转出到|到账账户|收款账户)[:：]?(微信|支付宝|银行卡)/)||[])[1]||'';
 if(kind==='transfer'&&!destination&&/微信/.test(flat))destination='微信';
 const names={expense:'消费',income:'收入',transfer:'账户转账／提现',refund:'退款',repayment:'还款',statement:'账单汇总'};
 // Stop before IDs, times and unrelated service panels. Order-column OCR can put all four values after the final label.
 const start=text.search(/商品总价|订单总额|订单金额|确认收货后付|实付|提现金额|到账金额|交易金额|还款金额|退款金额/);
 const region=(start>=0?text.slice(start):text).split(/订单编号|订单号|交易单号|交易快照|下单时间|付款时间|交易时间|服务保障|联系客服/)[0];
 let tokens=moneyTokens(region).filter(x=>!x.negative&&x.value>0),amount='',basis='';
 const labels=kind==='transfer'?['到账金额','实际到账','提现金额','转账金额']:kind==='income'?['到账金额','收入金额','收款金额']:kind==='repayment'?['还款金额','本次还款']:kind==='refund'?['退款金额','实退金额']:kind==='statement'?['本期应还','应还金额','待还总额','账单金额']:['确认收货后付','实付金额','实付款','实际支付','实际付款','合计实付','实付','应付金额','待付金额','支付金额','交易金额'];
 const total=moneyTokens(region);
 // Multiple standalone monetary rows after the final payable label are a column block, not adjacent label-value pairs.
 const tailLabel=labels.find(label=>region.includes(label));let column=false;
 if(tailLabel){const tail=region.slice(region.indexOf(tailLabel)+tailLabel.length);column=moneyTokens(tail).length>1&&moneyTokens(tail).every(x=>{const before=tail.slice(0,x.index).split('\n').at(-1).trim();return !/[\u3400-\u9fff]/.test(before)});}
 if(!column){for(const label of labels){const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');const re=new RegExp(escaped+'\\s*[：:]?\\s*(?:[¥￥Ұ·•・‧∙⋅｡。]|RMB|CNY|人民币|\\.(?=\\d+\\.))?\\s*([0-9][0-9,，]*(?:\\s*\\.\\s*[0-9]{1,2})?)','i');const m=region.match(re);if(m){const n=Number(m[1].replace(/[\s,，]/g,''));if(n>0&&n<1e9){amount=n.toFixed(2);basis='标签：'+label;break;}}}}
 if(!amount&&tokens.length){amount=tokens.at(-1).value.toFixed(2);basis='金额区域最后一个正金额（兜底，请核对）';warnings.push('使用最后金额兜底，请核对实付／实际到账');}
 if(!amount)warnings.push('金额未识别，请手动填写');
 if(basis)evidence.push(basis);
 const dateMatch=text.match(/20\d{2}\s*[-/年]\s*\d{1,2}\s*[-/月]\s*\d{1,2}/);let date='';if(dateMatch){const [y,m,d]=dateMatch[0].match(/\d+/g),v=`${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`,check=new Date(v+'T12:00:00Z');if(!isNaN(check)&&check.toISOString().slice(0,10)===v)date=v;}
 if(!date)warnings.push('未识别日期，已按记录日预填，请核对');
 const transactionId=(flat.match(/(?:订单编号|订单号|交易单号|交易号|提现单号)[:：]?([A-Za-z0-9-]{8,})/)||[])[1]||'';
 const merchant=(text.match(/(?:商户|商家|收款方|交易对方)\s*[：:]\s*([^\n]+)/)||[])[1]||(text.match(/([^\n]{2,45}(?:旗舰店|专卖店|专营店))/)||[])[1]||'';
 if(kind==='transfer')evidence.push('提现默认作为自有账户间转账，不重复计为收入；若是首次取得的报酬，请改选收入');
 if(deferred)evidence.push('先用后付：计入消费，现金尚待扣款');
 return {platform,kind,amount,date,timestamp:date,settlement,deferred,destination,merchant,transactionId,evidence,warnings,kindLabel:names[kind]||'待确认',text:String(raw||'')};
}
const api={parse,normalize,moneyTokens};root.CashMeshReceipt=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
