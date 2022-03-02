"use strict";require("./base.js");'use strict';global.tr.exportTo('tr.b',function(){function MultiDimensionalViewNode(title,valueCount){this.title=title;var dimensions=title.length;this.children=new Array(dimensions);for(var i=0;i<dimensions;i++)this.children[i]=new Map();this.values=new Array(valueCount);for(var v=0;v<valueCount;v++)this.values[v]={self:0,total:0,totalState:NOT_PROVIDED};}MultiDimensionalViewNode.TotalState={NOT_PROVIDED:0,LOWER_BOUND:1,EXACT:2};var NOT_PROVIDED=MultiDimensionalViewNode.TotalState.NOT_PROVIDED;var LOWER_BOUND=MultiDimensionalViewNode.TotalState.LOWER_BOUND;var EXACT=MultiDimensionalViewNode.TotalState.EXACT;MultiDimensionalViewNode.prototype={get subRows(){return tr.b.mapValues(this.children[0]);}};function MultiDimensionalViewBuilder(dimensions,valueCount){if(typeof dimensions!=='number'||dimensions<0)throw new Error('Dimensions must be a non-negative number');this.dimensions_=dimensions;if(typeof valueCount!=='number'||valueCount<0)throw new Error('Number of values must be a non-negative number');this.valueCount_=valueCount;this.buildRoot_=this.createRootNode_();this.topDownTreeViewRoot_=undefined;this.topDownHeavyViewRoot_=undefined;this.bottomUpHeavyViewNode_=undefined;this.maxDimensionDepths_=new Array(dimensions);for(var d=0;d<dimensions;d++)this.maxDimensionDepths_[d]=0;}MultiDimensionalViewBuilder.ValueKind={SELF:0,TOTAL:1};MultiDimensionalViewBuilder.ViewType={TOP_DOWN_TREE_VIEW:0,TOP_DOWN_HEAVY_VIEW:1,BOTTOM_UP_HEAVY_VIEW:2};MultiDimensionalViewBuilder.prototype={addPath:function(path,values,valueKind){if(this.buildRoot_===undefined){throw new Error('Paths cannot be added after either view has been built');}if(path.length!==this.dimensions_)throw new Error('Path must be '+this.dimensions_+'-dimensional');if(values.length!==this.valueCount_)throw new Error('Must provide '+this.valueCount_+' values');var isTotal;switch(valueKind){case MultiDimensionalViewBuilder.ValueKind.SELF:isTotal=false;break;case MultiDimensionalViewBuilder.ValueKind.TOTAL:isTotal=true;break;default:throw new Error('Invalid value kind: '+valueKind);}var node=this.buildRoot_;for(var d=0;d<path.length;d++){var singleDimensionPath=path[d];var singleDimensionPathLength=singleDimensionPath.length;this.maxDimensionDepths_[d]=Math.max(this.maxDimensionDepths_[d],singleDimensionPathLength);for(var i=0;i<singleDimensionPathLength;i++)node=this.getOrCreateChildNode_(node,d,singleDimensionPath[i]);}for(var v=0;v<this.valueCount_;v++){var addedValue=values[v];if(addedValue===undefined)continue;var nodeValue=node.values[v];if(isTotal){nodeValue.total+=addedValue;nodeValue.totalState=EXACT;}else{nodeValue.self+=addedValue;nodeValue.totalState=Math.max(nodeValue.totalState,LOWER_BOUND);}}},buildView:function(viewType){switch(viewType){case MultiDimensionalViewBuilder.ViewType.TOP_DOWN_TREE_VIEW:return this.buildTopDownTreeView();case MultiDimensionalViewBuilder.ViewType.TOP_DOWN_HEAVY_VIEW:return this.buildTopDownHeavyView();case MultiDimensionalViewBuilder.ViewType.BOTTOM_UP_HEAVY_VIEW:return this.buildBottomUpHeavyView();default:throw new Error('Unknown multi-dimensional view type: '+viewType);}},buildTopDownTreeView:function(){if(this.topDownTreeViewRoot_===undefined){var treeViewRoot=this.buildRoot_;this.buildRoot_=undefined;this.setUpMissingChildRelationships_(treeViewRoot,0);this.finalizeTotalValues_(treeViewRoot,0,new WeakMap());this.topDownTreeViewRoot_=treeViewRoot;}return this.topDownTreeViewRoot_;},buildTopDownHeavyView:function(){if(this.topDownHeavyViewRoot_===undefined){this.topDownHeavyViewRoot_=this.buildGenericHeavyView_(this.addDimensionToTopDownHeavyViewNode_.bind(this));}return this.topDownHeavyViewRoot_;},buildBottomUpHeavyView:function(){if(this.bottomUpHeavyViewNode_===undefined){this.bottomUpHeavyViewNode_=this.buildGenericHeavyView_(this.addDimensionToBottomUpHeavyViewNode_.bind(this));}return this.bottomUpHeavyViewNode_;},createRootNode_:function(){return new MultiDimensionalViewNode(new Array(this.dimensions_),this.valueCount_);},getOrCreateChildNode_:function(parentNode,dimension,childDimensionTitle){if(dimension<0||dimension>=this.dimensions_)throw new Error('Invalid dimension');var dimensionChildren=parentNode.children[dimension];var childNode=dimensionChildren.get(childDimensionTitle);if(childNode!==undefined)return childNode;var childTitle=parentNode.title.slice();childTitle[dimension]=childDimensionTitle;childNode=new MultiDimensionalViewNode(childTitle,this.valueCount_);dimensionChildren.set(childDimensionTitle,childNode);return childNode;},setUpMissingChildRelationships_:function(node,firstDimensionToSetUp){for(var d=firstDimensionToSetUp;d<this.dimensions_;d++){var currentDimensionChildTitles=new Set(node.children[d].keys());for(var i=0;i<d;i++){for(var previousDimensionChildNode of node.children[i].values()){for(var previousDimensionGrandChildTitle of previousDimensionChildNode.children[d].keys()){currentDimensionChildTitles.add(previousDimensionGrandChildTitle);}}}for(var currentDimensionChildTitle of currentDimensionChildTitles){var currentDimensionChildNode=this.getOrCreateChildNode_(node,d,currentDimensionChildTitle);for(var i=0;i<d;i++){for(var previousDimensionChildNode of node.children[i].values()){var previousDimensionGrandChildNode=previousDimensionChildNode.children[d].get(currentDimensionChildTitle);if(previousDimensionGrandChildNode!==undefined){currentDimensionChildNode.children[i].set(previousDimensionChildNode.title[i],previousDimensionGrandChildNode);}}}this.setUpMissingChildRelationships_(currentDimensionChildNode,d);}}},finalizeTotalValues_:function(node,firstDimensionToFinalize,dimensionalSelfSumsMap){var dimensionalSelfSums=new Array(this.dimensions_);var minResidual=new Array(this.valueCount_);for(var v=0;v<this.valueCount_;v++)minResidual[v]=0;var nodeValues=node.values;var nodeSelfSums=new Array(this.valueCount_);for(var v=0;v<this.valueCount_;v++)nodeSelfSums[v]=nodeValues[v].self;for(var d=0;d<this.dimensions_;d++){var childResidualSums=new Array(this.valueCount_);for(var v=0;v<this.valueCount_;v++)childResidualSums[v]=0;for(var childNode of node.children[d].values()){if(d>=firstDimensionToFinalize)this.finalizeTotalValues_(childNode,d,dimensionalSelfSumsMap);var childNodeSelfSums=dimensionalSelfSumsMap.get(childNode);var childNodeValues=childNode.values;for(var v=0;v<this.valueCount_;v++){nodeSelfSums[v]+=childNodeSelfSums[d][v];var residual=childNodeValues[v].total-childNodeSelfSums[this.dimensions_-1][v];childResidualSums[v]+=residual;if(childNodeValues[v].totalState>NOT_PROVIDED){nodeValues[v].totalState=Math.max(nodeValues[v].totalState,LOWER_BOUND);}}}dimensionalSelfSums[d]=nodeSelfSums.slice();for(var v=0;v<this.valueCount_;v++)minResidual[v]=Math.max(minResidual[v],childResidualSums[v]);}for(var v=0;v<this.valueCount_;v++){nodeValues[v].total=Math.max(nodeValues[v].total,nodeSelfSums[v]+minResidual[v]);}if(dimensionalSelfSumsMap.has(node))throw new Error('Internal error: Node finalized more than once');dimensionalSelfSumsMap.set(node,dimensionalSelfSums);},buildGenericHeavyView_:function(treeViewNodeHandler){var treeViewRoot=this.buildTopDownTreeView();var heavyViewRoot=this.createRootNode_();heavyViewRoot.values=treeViewRoot.values;var recursionDepthTrackers=new Array(this.dimensions_);for(var d=0;d<this.dimensions_;d++){recursionDepthTrackers[d]=new RecursionDepthTracker(this.maxDimensionDepths_[d],d);}this.addDimensionsToGenericHeavyViewNode_(treeViewRoot,heavyViewRoot,0,recursionDepthTrackers,false,treeViewNodeHandler);this.setUpMissingChildRelationships_(heavyViewRoot,0);return heavyViewRoot;},addDimensionsToGenericHeavyViewNode_:function(treeViewParentNode,heavyViewParentNode,startDimension,recursionDepthTrackers,previousDimensionsRecursive,treeViewNodeHandler){for(var d=startDimension;d<this.dimensions_;d++){this.addDimensionDescendantsToGenericHeavyViewNode_(treeViewParentNode,heavyViewParentNode,d,recursionDepthTrackers,previousDimensionsRecursive,treeViewNodeHandler);}},addDimensionDescendantsToGenericHeavyViewNode_:function(treeViewParentNode,heavyViewParentNode,currentDimension,recursionDepthTrackers,previousDimensionsRecursive,treeViewNodeHandler){var treeViewChildren=treeViewParentNode.children[currentDimension];var recursionDepthTracker=recursionDepthTrackers[currentDimension];for(var treeViewChildNode of treeViewChildren.values()){recursionDepthTracker.push(treeViewChildNode);treeViewNodeHandler(treeViewChildNode,heavyViewParentNode,currentDimension,recursionDepthTrackers,previousDimensionsRecursive);this.addDimensionDescendantsToGenericHeavyViewNode_(treeViewChildNode,heavyViewParentNode,currentDimension,recursionDepthTrackers,previousDimensionsRecursive,treeViewNodeHandler);recursionDepthTracker.pop();}},addDimensionToTopDownHeavyViewNode_:function(treeViewChildNode,heavyViewParentNode,currentDimension,recursionDepthTrackers,previousDimensionsRecursive){this.addDimensionToTopDownHeavyViewNodeRecursively_(treeViewChildNode,heavyViewParentNode,currentDimension,recursionDepthTrackers,previousDimensionsRecursive,1);},addDimensionToTopDownHeavyViewNodeRecursively_:function(treeViewChildNode,heavyViewParentNode,currentDimension,recursionDepthTrackers,previousDimensionsRecursive,subTreeDepth){var recursionDepthTracker=recursionDepthTrackers[currentDimension];var currentDimensionRecursive=subTreeDepth<=recursionDepthTracker.recursionDepth;var currentOrPreviousDimensionsRecursive=currentDimensionRecursive||previousDimensionsRecursive;var dimensionTitle=treeViewChildNode.title[currentDimension];var heavyViewChildNode=this.getOrCreateChildNode_(heavyViewParentNode,currentDimension,dimensionTitle);this.addNodeValues_(treeViewChildNode,heavyViewChildNode,!currentOrPreviousDimensionsRecursive);this.addDimensionsToGenericHeavyViewNode_(treeViewChildNode,heavyViewChildNode,currentDimension+1,recursionDepthTrackers,currentOrPreviousDimensionsRecursive,this.addDimensionToTopDownHeavyViewNode_.bind(this));for(var treeViewGrandChildNode of treeViewChildNode.children[currentDimension].values()){recursionDepthTracker.push(treeViewGrandChildNode);this.addDimensionToTopDownHeavyViewNodeRecursively_(treeViewGrandChildNode,heavyViewChildNode,currentDimension,recursionDepthTrackers,previousDimensionsRecursive,subTreeDepth+1);recursionDepthTracker.pop();}},addDimensionToBottomUpHeavyViewNode_:function(treeViewChildNode,heavyViewParentNode,currentDimension,recursionDepthTrackers,previousDimensionsRecursive){var recursionDepthTracker=recursionDepthTrackers[currentDimension];var bottomIndex=recursionDepthTracker.bottomIndex;var topIndex=recursionDepthTracker.topIndex;var firstNonRecursiveIndex=bottomIndex+recursionDepthTracker.recursionDepth;var viewNodePath=recursionDepthTracker.viewNodePath;var trackerAncestorNode=recursionDepthTracker.trackerAncestorNode;var heavyViewDescendantNode=heavyViewParentNode;for(var i=bottomIndex;i<topIndex;i++){var treeViewAncestorNode=viewNodePath[i];var dimensionTitle=treeViewAncestorNode.title[currentDimension];heavyViewDescendantNode=this.getOrCreateChildNode_(heavyViewDescendantNode,currentDimension,dimensionTitle);var currentDimensionRecursive=i<firstNonRecursiveIndex;var currentOrPreviousDimensionsRecursive=currentDimensionRecursive||previousDimensionsRecursive;this.addNodeValues_(treeViewChildNode,heavyViewDescendantNode,!currentOrPreviousDimensionsRecursive);this.addDimensionsToGenericHeavyViewNode_(treeViewChildNode,heavyViewDescendantNode,currentDimension+1,recursionDepthTrackers,currentOrPreviousDimensionsRecursive,this.addDimensionToBottomUpHeavyViewNode_.bind(this));}},addNodeValues_:function(sourceNode,targetNode,addTotal){var targetNodeValues=targetNode.values;var sourceNodeValues=sourceNode.values;for(var v=0;v<this.valueCount_;v++){var targetNodeValue=targetNodeValues[v];var sourceNodeValue=sourceNodeValues[v];targetNodeValue.self+=sourceNodeValue.self;if(addTotal){targetNodeValue.total+=sourceNodeValue.total;if(sourceNodeValue.totalState>NOT_PROVIDED){targetNodeValue.totalState=Math.max(targetNodeValue.totalState,LOWER_BOUND);}}}}};function RecursionDepthTracker(maxDepth,dimension){this.titlePath=new Array(maxDepth);this.viewNodePath=new Array(maxDepth);this.bottomIndex=this.topIndex=maxDepth;this.dimension_=dimension;this.currentTrackerNode_=this.createNode_(0,undefined);}RecursionDepthTracker.prototype={push:function(viewNode){if(this.bottomIndex===0)throw new Error('Cannot push to a full tracker');var title=viewNode.title[this.dimension_];this.bottomIndex--;this.titlePath[this.bottomIndex]=title;this.viewNodePath[this.bottomIndex]=viewNode;var childTrackerNode=this.currentTrackerNode_.children.get(title);if(childTrackerNode!==undefined){this.currentTrackerNode_=childTrackerNode;return;}var maxLengths=zFunction(this.titlePath,this.bottomIndex);var recursionDepth=0;for(var i=0;i<maxLengths.length;i++)recursionDepth=Math.max(recursionDepth,maxLengths[i]);childTrackerNode=this.createNode_(recursionDepth,this.currentTrackerNode_);this.currentTrackerNode_.children.set(title,childTrackerNode);this.currentTrackerNode_=childTrackerNode;},pop:function(){if(this.bottomIndex===this.topIndex)throw new Error('Cannot pop from an empty tracker');this.titlePath[this.bottomIndex]=undefined;this.viewNodePath[this.bottomIndex]=undefined;this.bottomIndex++;this.currentTrackerNode_=this.currentTrackerNode_.parent;},get recursionDepth(){return this.currentTrackerNode_.recursionDepth;},createNode_:function(recursionDepth,parent){return{recursionDepth:recursionDepth,parent:parent,children:new Map()};}};function zFunction(list,startIndex){var n=list.length-startIndex;if(n===0)return[];var z=new Array(n);z[0]=0;for(var i=1,left=0,right=0;i<n;++i){var maxLength;if(i<=right)maxLength=Math.min(right-i+1,z[i-left]);else maxLength=0;while(i+maxLength<n&&list[startIndex+maxLength]===list[startIndex+i+maxLength]){++maxLength;}if(i+maxLength-1>right){left=i;right=i+maxLength-1;}z[i]=maxLength;}return z;}return{MultiDimensionalViewBuilder:MultiDimensionalViewBuilder,MultiDimensionalViewNode:MultiDimensionalViewNode,RecursionDepthTracker:RecursionDepthTracker,zFunction:zFunction};});