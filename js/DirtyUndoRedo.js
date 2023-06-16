import { app } from "/scripts/app.js";
import { workflowHistory } from "/extensions/ZZZ-Bmad-DirtyUndoRedo/WorkflowHistory.js";

//IMPORTANT, this extension should be the last to be loaded, so make sure the folder is the last alphabetically

app.registerExtension({
    name: "Comfy.Bmad.DirtyUndoRedo",
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

        const onNodeCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

            this.onMouseDown = function (event) {
                //console.log("onMouseDown");

                // set fixed node order so that state comparison works properly and avoids repeating the same state
                // (is this really required tho? why not use _nodes_in_order when serializing? )
                for (let i = 0; i < app.graph._nodes.length; i++) app.graph._nodes[i] = app.graph._nodes_in_order[i];
                return false;
            };

            return r;
        }

    },
    loadedGraphNode(node, _) {
        if (app.graph._nodes_in_order[0] !== node) return;// execute only once

        workflowHistory.setup(app);

        // do not clean undo history if loading was triggered by an undo/redo command
        if (app.wh.disable_load_reset) 
        {
            app.wh.disable_load_reset = false;
            return;
        }

        app.wh.clean_history(app);
        app.wh.get_new_candidate_state(app);
    }
});


//=======================================================================================
//          Override LiteGraph default behaviors

LGraphCanvas.onMenuNodeColors = function (value, options, e, menu, node) {
    if (!node) {
        throw "no node for color";
    }

    var values = [];
    values.push({
        value: null,
        content:
            "<span style='display: block; padding-left: 4px;'>No color</span>"
    });

    for (var i in LGraphCanvas.node_colors) {
        var color = LGraphCanvas.node_colors[i];
        var value = {
            value: i,
            content:
                "<span style='display: block; color: #999; padding-left: 4px; border-left: 8px solid " +
                color.color +
                "; background-color:" +
                color.bgcolor +
                "'>" +
                i +
                "</span>"
        };
        values.push(value);
    }
    new LiteGraph.ContextMenu(values, {
        event: e,
        callback: inner_clicked,
        parentMenu: menu,
        node: node
    });

    function inner_clicked(v) {
        if (!node) {
            return;
        }

        var color = v.value ? LGraphCanvas.node_colors[v.value] : null;

        var fApplyColor = function (node) {
            if (color) {
                if (node.constructor === LiteGraph.LGraphGroup) {
                    node.color = color.groupcolor;
                } else {
                    node.color = color.color;
                    node.bgcolor = color.bgcolor;
                }
            } else {
                delete node.color;
                delete node.bgcolor;
            }
        }

        workflowHistory.prev_undo_timestamp -= workflowHistory.state_merge_threshold; // force potential push state
        workflowHistory.before();
        workflowHistory.lock();
        var graphcanvas = LGraphCanvas.active_canvas;
        if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
            fApplyColor(node);
        } else {
            for (var i in graphcanvas.selected_nodes) {
                fApplyColor(graphcanvas.selected_nodes[i]);
            }
        }
        node.setDirtyCanvas(true, true);
        workflowHistory.release();
        workflowHistory.after();
    }

    return false;
};


LGraphCanvas.onMenuNodeShapes = function (value, options, e, menu, node) {
    if (!node) {
        throw "no node passed";
    }

    new LiteGraph.ContextMenu(LiteGraph.VALID_SHAPES, {
        event: e,
        callback: inner_clicked,
        parentMenu: menu,
        node: node
    });

    function inner_clicked(v) {
        if (!node) {
            return;
        }
        node.graph.beforeChange(/*?*/); //node

        var fApplyMultiNode = function (node) {
            node.shape = v;
        }

        workflowHistory.prev_undo_timestamp -= workflowHistory.state_merge_threshold; // force potential push state
        workflowHistory.before();
        workflowHistory.lock();
        var graphcanvas = LGraphCanvas.active_canvas;
        if (!graphcanvas.selected_nodes || Object.keys(graphcanvas.selected_nodes).length <= 1) {
            fApplyMultiNode(node);
        } else {
            for (var i in graphcanvas.selected_nodes) {
                fApplyMultiNode(graphcanvas.selected_nodes[i]);
            }
        }

        node.graph.afterChange(/*?*/); //node
        node.setDirtyCanvas(true);
        workflowHistory.release();
        workflowHistory.after();
    }

    return false;
}


LGraphCanvas.prototype.original_prompt = LGraphCanvas.prototype.prompt;
LGraphCanvas.prototype.prompt = function(title, value, callback, event, multiline) {
    //console.log("LGraphCanvas.prototype.prompt");
    const new_callback = function(node){
        //workflowHistory.before() should have been triggered on mouse click
        callback(node);
        workflowHistory.after();
    }
    return this.original_prompt(title, value, new_callback, event, multiline);
};


LiteGraph.ContextMenu.prototype.original_close = LiteGraph.ContextMenu.prototype.close;
LiteGraph.ContextMenu.prototype.close = function(e, ignore_parent_menu) {
    //console.log("LiteGraph.ContextMenu.prototype.close");
    const r = this.original_close(e, ignore_parent_menu);
    workflowHistory.after();
    return r;
}