import { app } from "/scripts/app.js";
import { workflowHistory } from "./WorkflowHistory.js";


function overrideLiteGraphBehaviors() {
    LGraphCanvas.prototype.original_prompt = LGraphCanvas.prototype.prompt;
    LGraphCanvas.prototype.prompt = function (title, value, callback, event, multiline) {
        const new_callback = function (node) {
            //workflowHistory.before() should have been triggered on mouse click
            callback(node);
            workflowHistory.after();
        }
        return this.original_prompt(title, value, new_callback, event, multiline);
    };

    // note: selecting custom color does not trigger ContextMenu close; this is a edge case
    LiteGraph.ContextMenu.prototype.original_close = LiteGraph.ContextMenu.prototype.close;
    LiteGraph.ContextMenu.prototype.close = function (e, ignore_parent_menu) {
        const r = this.original_close(e, ignore_parent_menu);
        workflowHistory.after();
        return r;
    }
}


let extension = {
    name: "Comfy.Bmad.DirtyUndoRedo",

    async setup() {
        overrideLiteGraphBehaviors();
        workflowHistory._setup(app);
        app.workflowHistory = workflowHistory;
    },

    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        const origGetExtraMenuOptions = nodeType.prototype.getExtraMenuOptions;
        nodeType.prototype.getExtraMenuOptions = function (_, options) {
            const r = origGetExtraMenuOptions ? origGetExtraMenuOptions.apply(this, arguments) : undefined;
            //console.log(options);
            if (options !== undefined)
                for (let i = 0; i < options.length; i++) if (options[i]) {
                    const opt = options[i];
                    if (opt.has_submenu) continue;
                    const o_callback = opt.callback;
                    opt.callback = function () {
                        workflowHistory.prev_undo_timestamp -= workflowHistory.state_merge_threshold;
                        workflowHistory.before();
                        workflowHistory.lock();
                        let ocr = undefined;
                        try {
                            ocr = o_callback ? o_callback.apply(this, arguments) : undefined;
                        } catch (e) { }
                        workflowHistory.release();
                        workflowHistory.after();
                        return ocr;
                    }
                }
            return r;
        }
    },
    loadedGraphNode(node, _) {
        if (app.graph._nodes_in_order[0] !== node) return;// execute only once

        // do not clean undo history if loading was triggered by an undo/redo command
        if (workflowHistory.disable_load_reset) {
            workflowHistory.disable_load_reset = false;
            return;
        }

        workflowHistory.clean_history(app);
        workflowHistory.get_new_candidate_state(app);
    }
};


app.registerExtension({
    name: "Comfy.Bmad.DirtyUndoRedo.Meta",
    async init() {
        // add DirtyUndoRedo exntension; this approach attempts to make it the last loaded extension
        //   to try to avoid problems w/ other extensions that override litegraph behaviors 
        app.extensions.push(extension); 
    }
})
