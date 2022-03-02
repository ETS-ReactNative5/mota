"use strict";require("./splaytree.js");'use strict';global.tr.exportTo('tr.e.importer.v8',function(){function CodeMap(){this.dynamics_=new tr.e.importer.v8.SplayTree();this.dynamicsNameGen_=new tr.e.importer.v8.CodeMap.NameGenerator();this.statics_=new tr.e.importer.v8.SplayTree();this.libraries_=new tr.e.importer.v8.SplayTree();this.pages_=[];}CodeMap.PAGE_ALIGNMENT=12;CodeMap.PAGE_SIZE=1<<CodeMap.PAGE_ALIGNMENT;CodeMap.prototype.addCode=function(start,codeEntry){this.deleteAllCoveredNodes_(this.dynamics_,start,start+codeEntry.size);this.dynamics_.insert(start,codeEntry);};CodeMap.prototype.moveCode=function(from,to){var removedNode=this.dynamics_.remove(from);this.deleteAllCoveredNodes_(this.dynamics_,to,to+removedNode.value.size);this.dynamics_.insert(to,removedNode.value);};CodeMap.prototype.deleteCode=function(start){var removedNode=this.dynamics_.remove(start);};CodeMap.prototype.addLibrary=function(start,codeEntry){this.markPages_(start,start+codeEntry.size);this.libraries_.insert(start,codeEntry);};CodeMap.prototype.addStaticCode=function(start,codeEntry){this.statics_.insert(start,codeEntry);};CodeMap.prototype.markPages_=function(start,end){for(var addr=start;addr<=end;addr+=CodeMap.PAGE_SIZE){this.pages_[addr>>>CodeMap.PAGE_ALIGNMENT]=1;}};CodeMap.prototype.deleteAllCoveredNodes_=function(tree,start,end){var toDelete=[];var addr=end-1;while(addr>=start){var node=tree.findGreatestLessThan(addr);if(!node)break;var start2=node.key,end2=start2+node.value.size;if(start2<end&&start<end2)toDelete.push(start2);addr=start2-1;}for(var i=0,l=toDelete.length;i<l;++i)tree.remove(toDelete[i]);};CodeMap.prototype.isAddressBelongsTo_=function(addr,node){return addr>=node.key&&addr<node.key+node.value.size;};CodeMap.prototype.findInTree_=function(tree,addr){var node=tree.findGreatestLessThan(addr);return node&&this.isAddressBelongsTo_(addr,node)?node.value:null;};CodeMap.prototype.findEntryInLibraries=function(addr){var pageAddr=addr>>>CodeMap.PAGE_ALIGNMENT;if(pageAddr in this.pages_)return this.findInTree_(this.libraries_,addr);return undefined;};CodeMap.prototype.findEntry=function(addr){var pageAddr=addr>>>CodeMap.PAGE_ALIGNMENT;if(pageAddr in this.pages_){return this.findInTree_(this.statics_,addr)||this.findInTree_(this.libraries_,addr);}var min=this.dynamics_.findMin();var max=this.dynamics_.findMax();if(max!=null&&addr<max.key+max.value.size&&addr>=min.key){var dynaEntry=this.findInTree_(this.dynamics_,addr);if(dynaEntry==null)return null;if(!dynaEntry.nameUpdated_){dynaEntry.name=this.dynamicsNameGen_.getName(dynaEntry.name);dynaEntry.nameUpdated_=true;}return dynaEntry;}return null;};CodeMap.prototype.findDynamicEntryByStartAddress=function(addr){var node=this.dynamics_.find(addr);return node?node.value:null;};CodeMap.prototype.getAllDynamicEntries=function(){return this.dynamics_.exportValues();};CodeMap.prototype.getAllDynamicEntriesWithAddresses=function(){return this.dynamics_.exportKeysAndValues();};CodeMap.prototype.getAllStaticEntries=function(){return this.statics_.exportValues();};CodeMap.prototype.getAllLibrariesEntries=function(){return this.libraries_.exportValues();};CodeMap.CodeState={COMPILED:0,OPTIMIZABLE:1,OPTIMIZED:2};CodeMap.CodeEntry=function(size,opt_name,opt_type){this.id=tr.b.GUID.allocateSimple();this.size=size;this.name_=opt_name||'';this.type=opt_type||'';this.nameUpdated_=false;};CodeMap.CodeEntry.prototype={__proto__:Object.prototype,get name(){return this.name_;},set name(value){this.name_=value;},toString:function(){this.name_+': '+this.size.toString(16);}};CodeMap.CodeEntry.TYPE={SHARED_LIB:'SHARED_LIB',CPP:'CPP'};CodeMap.DynamicFuncCodeEntry=function(size,type,func,state){CodeMap.CodeEntry.call(this,size,'',type);this.func=func;this.state=state;};CodeMap.DynamicFuncCodeEntry.STATE_PREFIX=['','~','*'];CodeMap.DynamicFuncCodeEntry.prototype={__proto__:CodeMap.CodeEntry.prototype,get name(){return CodeMap.DynamicFuncCodeEntry.STATE_PREFIX[this.state]+this.func.name;},set name(value){this.name_=value;},getRawName:function(){return this.func.getName();},isJSFunction:function(){return true;},toString:function(){return this.type+': '+this.name+': '+this.size.toString(16);}};CodeMap.FunctionEntry=function(name){CodeMap.CodeEntry.call(this,0,name);};CodeMap.FunctionEntry.prototype={__proto__:CodeMap.CodeEntry.prototype,get name(){var name=this.name_;if(name.length==0){name='<anonymous>';}else if(name.charAt(0)==' '){name='<anonymous>'+name;}return name;},set name(value){this.name_=value;}};CodeMap.NameGenerator=function(){this.knownNames_={};};CodeMap.NameGenerator.prototype.getName=function(name){if(!(name in this.knownNames_)){this.knownNames_[name]=0;return name;}var count=++this.knownNames_[name];return name+' {'+count+'}';};return{CodeMap:CodeMap};});