/* Offline outbox and optimistic record versions. Does not depend on the UI or provider SDK. */
(function(root){'use strict';
const fields=['id','date','kind','platform','amount','settlement','merchant','destination','transactionId','sync','createdAt','updatedAt'];
function clean(row){const result={};for(const k of fields)if(row[k]!==undefined)result[k]=row[k];return result;}
class Engine{
 constructor({storage,key,read,write,rpc,id}){Object.assign(this,{storage,key,read,write,rpc,id});this.s=JSON.parse(storage.getItem(key)||'{"cursor":0,"versions":{},"observed":{},"pending":{}}');this.running=false;this.flight=new Set();}
 save(){this.storage.setItem(this.key,JSON.stringify(this.s));}
 capture(){const current={};for(const row of this.read())current[row.id]=JSON.stringify(clean(row));for(const [id,value] of Object.entries(current)){if(this.s.observed[id]!==value){const prev=this.s.pending[id];this.s.pending[id]={id,base:prev?.base??this.s.versions[id]??0,op:this.id(),data:JSON.parse(value),deleted:false,...(prev?.conflict?{conflict:prev.conflict}:{})};}}
 for(const id of Object.keys(this.s.observed)){if(!(id in current)){const p=this.s.pending[id];if(!(this.s.versions[id]||p?.base)&&!this.flight.has(id))delete this.s.pending[id];else this.s.pending[id]={id,base:p?.base??this.s.versions[id],op:this.id(),data:null,deleted:true,...(p?.conflict?{conflict:p.conflict}:{})};}}
 this.s.observed=current;this.save();}
 conflicts(){return Object.values(this.s.pending).filter(x=>x.conflict);}
 async exchange(){if(this.running)return;this.running=true;try{this.capture();let more;do{const ops=Object.values(this.s.pending).filter(x=>!x.conflict).slice(0,100).map(({conflict,...x})=>x);const sent=new Map(ops.map(x=>[x.id,x]));this.flight=new Set(ops.map(x=>x.id));const reply=await this.rpc({cursor:this.s.cursor,ops});if(!Array.isArray(reply.results)||!Array.isArray(reply.changes)||!Number.isSafeInteger(reply.cursor)||reply.cursor<this.s.cursor)throw Error('云端返回的数据格式不正确');
 // Local saves may have happened while awaiting the server; capture before applying a response.
 this.capture();
 for(const result of reply.results){const queued=this.s.pending[result.id],was=sent.get(result.id);if(!queued||!was||result.op!==was.op)continue;if(result.status==='ok'){this.s.versions[result.id]=result.revision;if(queued.op===was.op)delete this.s.pending[result.id];else queued.base=result.revision;}else if(result.status==='conflict'){queued.conflict=result.remote||{record_id:result.id,revision:0,deleted:true,payload:null};}}
 const current=new Map(this.read().map(x=>[x.id,x]));
 for(const change of reply.changes){if(!change||typeof change.record_id!=='string'||!Number.isSafeInteger(change.revision)||change.revision<1)throw Error('云端记录版本无效');const pending=this.s.pending[change.record_id];if(pending)continue;this.s.versions[change.record_id]=change.revision;if(change.deleted)current.delete(change.record_id);else current.set(change.record_id,{...current.get(change.record_id),...clean(change.payload)});}
 const next=[...current.values()];this.write(next);this.s.observed=Object.fromEntries(next.map(x=>[x.id,JSON.stringify(clean(x))]));this.s.cursor=reply.cursor;this.save();more=reply.hasMore||Object.values(this.s.pending).some(x=>!x.conflict);}while(more);return {pending:Object.keys(this.s.pending).length,conflicts:this.conflicts().length};}finally{this.flight.clear();this.running=false;}}
 resolve(id,choice){const p=this.s.pending[id];if(!p?.conflict)return;const remote=p.conflict;this.s.versions[id]=remote.revision||0;if(choice==='local'){p.base=remote.revision||0;p.op=this.id();delete p.conflict;}else if(choice==='cloud'){const rows=new Map(this.read().map(x=>[x.id,x]));if(remote.deleted||!remote.payload)rows.delete(id);else rows.set(id,{...rows.get(id),...clean(remote.payload)});const next=[...rows.values()];this.write(next);delete this.s.pending[id];this.s.observed=Object.fromEntries(next.map(x=>[x.id,JSON.stringify(clean(x))]));}else throw Error('请选择保留哪一份记录');this.save();}
}
root.CashMeshSync={Engine,clean};
})(typeof window==='undefined'?globalThis:window);
