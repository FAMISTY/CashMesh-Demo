const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');const elements=new Map();function el(id){if(!elements.has(id))elements.set(id,{value:'',checked:false,innerHTML:'',textContent:'',className:'',dataset:{},files:[],showModal(){},close(){},querySelectorAll(){return []}});return elements.get(id)}el('filter').value='all';el('periods').value='6';el('delay').value='30';const ctx={document:{getElementById:el,querySelectorAll:()=>[],createElement:()=>({click(){}})},localStorage:{getItem:()=>null,setItem(){},removeItem(){}},crypto:require('crypto').webcrypto,window:{},console,Date,TextDecoder,Blob,URL,setTimeout};vm.createContext(ctx);for(const m of fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8').matchAll(/<script>([\s\S]*?)<\/script>/g))vm.runInContext(m[1],ctx);
const C=ctx.window.CashMesh;
vm.runInContext("batches=[{uid:'pdf',name:'bank.pdf',isPdf:true,heads:['交易日期','交易金额'],rows:[],emptyPages:[]}]",ctx);
ctx.document.querySelector=()=>({checked:false});assert.throws(()=>C.importRows(),/勾选确认/);
ctx.document.querySelector=selector=>selector.includes('data-pdf-confirm')?{checked:true}:selector.includes('data-pdf-review')?{value:'交易日期,交易金额\\n2026-10-01,wrong'.replace('\\n','\n')}:{value:'银行'};
assert.throws(()=>C.importRows(),/未核对完成/);
vm.runInContext('batches[0].emptyPages=[2]',ctx);assert.throws(()=>C.importRows(),/OCR/);
console.log('PASS: PDF confirmation requirement, invalid amount blocks import, partial image pages block incomplete imports.');
