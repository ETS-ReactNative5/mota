"use strict";require("../base/iteration_helpers.js");require("./event_set.js");'use strict';global.tr.exportTo('tr.model',function(){function getAssociatedEvents(irs){var allAssociatedEvents=new tr.model.EventSet();irs.forEach(function(ir){ir.associatedEvents.forEach(function(event){if(event instanceof tr.model.FlowEvent)return;allAssociatedEvents.push(event);});});return allAssociatedEvents;}function getUnassociatedEvents(model,associatedEvents){var unassociatedEvents=new tr.model.EventSet();for(var proc of model.getAllProcesses())for(var thread of tr.b.dictionaryValues(proc.threads))for(var event of thread.sliceGroup.getDescendantEvents())if(!associatedEvents.contains(event))unassociatedEvents.push(event);return unassociatedEvents;}function getTotalCpuDuration(events){var cpuMs=0;events.forEach(function(event){if(event.cpuSelfTime)cpuMs+=event.cpuSelfTime;});return cpuMs;}function getIRCoverageFromModel(model){var associatedEvents=getAssociatedEvents(model.userModel.expectations);if(!associatedEvents.length)return undefined;var unassociatedEvents=getUnassociatedEvents(model,associatedEvents);var associatedCpuMs=getTotalCpuDuration(associatedEvents);var unassociatedCpuMs=getTotalCpuDuration(unassociatedEvents);var totalEventCount=associatedEvents.length+unassociatedEvents.length;var totalCpuMs=associatedCpuMs+unassociatedCpuMs;var coveredEventsCpuTimeRatio=undefined;if(totalCpuMs!==0)coveredEventsCpuTimeRatio=associatedCpuMs/totalCpuMs;return{associatedEventsCount:associatedEvents.length,unassociatedEventsCount:unassociatedEvents.length,associatedEventsCpuTimeMs:associatedCpuMs,unassociatedEventsCpuTimeMs:unassociatedCpuMs,coveredEventsCountRatio:associatedEvents.length/totalEventCount,coveredEventsCpuTimeRatio:coveredEventsCpuTimeRatio};}return{getIRCoverageFromModel:getIRCoverageFromModel,getAssociatedEvents:getAssociatedEvents,getUnassociatedEvents:getUnassociatedEvents};});