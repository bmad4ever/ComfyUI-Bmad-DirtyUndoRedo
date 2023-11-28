export class WorkflowHistory {

    /**
     * @description
     * SYSTEM_TYPE determines the type of operating system the user is currently on. If the user is on a Mac or related products (like iMac, MacBook), it's set to 'mac'; otherwise, it defaults to 'default'.
     * This static property is assigned only once throughout its lifecycle. Subsequent checks for the system type won't need repeated evaluations.
     */
    static SYSTEM_TYPE = (/Mac|iMac|MacBook/i.test(navigator.platform)) ? 'mac' : 'default';

    // STORES ENTIRE GRAPH STATE *NOT THE CHANGES !!!


    lock() { this.enabled = false; }
    release() { this.enabled = true; }
    isBetweenOnBeforeAndOnAfter() { return this.b_count > 0; }


    /**
     * Set mouse, keys and graph events' callbacks.
     * @param {ComfyApp} app 
     */
    _setup(app) {
        // overrides on top of comfy to be able to access selected_group_moving immidiatly after being updated; 
        //   this is not accessible in OnMouseDown, which is the last method called by the original processMouseDown
        app.canvas.og_comfy_processMouseDown = app.canvas.processMouseDown;
        LiteGraph.pointerListenerRemove(app.canvasEl, "down", app.canvas._mousedown_callback, true);
        app.canvas.processMouseDown = function (e) {
            const r = app.canvas.og_comfy_processMouseDown.apply(this, arguments);

            if (!workflowHistory.enabled) return r;
            if (workflowHistory.b_count > 0) return r; // ignore node clicks since OnBeforeChange was already triggered
            if (this.dragging_canvas && !this.selected_group_resizing && !this.selected_group_moving)
                return r;

            // Note: clicking on a node triggers onBefore before the processMouseDown; and clicking on a Group only triggers processMouseDown
            workflowHistory.before(true);

            // only check for potential new state on mouseup if the user clicked on something
            workflowHistory.check_mouse_up = true

            return r;
        };
        app.canvas._mousedown_callback = app.canvas.processMouseDown.bind(app.canvas);
        LiteGraph.pointerListenerAdd(app.canvasEl, "down", app.canvas._mousedown_callback, true);

        window.onmousedown = function (e) {
            workflowHistory.before(true);
        }


        const o__mouseup_callback = app.canvas._mouseup_callback;
        app.canvas._mouseup_callback = function (event) {
            const r = o__mouseup_callback ? o__mouseup_callback.apply(this, arguments) : undefined;

            if (!workflowHistory.enabled) return r;
            if (!workflowHistory.check_mouse_up) return r;
            workflowHistory.check_mouse_up = false;

            const leftClick = 1;
            const rightClick = 3;

            if (event.which === leftClick) {
                workflowHistory.after();
            }

            if (event.which === rightClick) {
                workflowHistory.before(); // ??
            }

            return r;
        };


        /**
        * @description
        * Normalizes the given key combination string.
        * @param {string} keyCombination - The key combination string to be normalized.
        * @returns {string} - The normalized key combination string.
        */
        function normalizeKeyCombination(keyCombination) {
            const order = ['ctrl', 'meta', 'shift', 'alt', 'option'];
            const keys = keyCombination.toLowerCase().split('+').sort((a, b) => {
                return order.indexOf(a) - order.indexOf(b);
            });
            return keys.join('+');
        }

        // Normalize key combinations in keyMappings
        const normalizeMappings = (mappings) => {
            const normalizedMappings = {};
            for (let key in mappings) {
                const normalizedKey = normalizeKeyCombination(key);
                normalizedMappings[normalizedKey] = mappings[key];
            }
            return normalizedMappings;
        };

        /**
        * @description
        * keyMappings defines the mapping relationships between keyboard shortcuts and operations for different operating systems.
        */
        const keyMappings = {
            default: normalizeMappings({
                'ctrl+z': () => this.undo(app),
                'ctrl+y': () => this.redo(app),
                'ctrl+shift+z': () => this.redo(app),
                // ... other mappings ...
            }),
            mac: normalizeMappings({
                'meta+z': () => this.undo(app),
                'meta+shift+z': () => this.redo(app),
                'ctrl+z': () => this.undo(app),
                'ctrl+shift+z': () => this.redo(app),
                'ctrl+y': () => this.redo(app),
                // ... other mappings ...
            })
        };

        const currentKeyMappings = keyMappings[WorkflowHistory.SYSTEM_TYPE];

        this.repKeyCount = 0;
        window.addEventListener("keydown", function (event) {
            if (workflowHistory.prevKey === event.key.toLowerCase()) return; //avoid quick auto spamm
            else if (workflowHistory.prevKey !== null) {
                clearTimeout(workflowHistory.keyTimeout);
                workflowHistory.repKeyCount = 0;
            }

            if (app.graph.list_of_graphcanvas[0].getCanvasWindow().document.activeElement.nodeName.toLowerCase() == "textarea")
                return; // ignore when editing text
            if (document.getElementsByClassName("graphdialog").length > 0)
                return; // ignore when editing property via dialog

            /**
             * @description
             * keyCombination records the key combination pressed by the user, so we can detect and match the corresponding operation.
             */
            const keyCombination = [
                event.ctrlKey && 'ctrl',
                event.metaKey && 'meta',
                event.shiftKey && 'shift',
                event.altKey && (WorkflowHistory.SYSTEM_TYPE == 'mac' ? 'option' : 'alt'),
                event.key.toLowerCase()
            ].filter(Boolean).join('+');

            // Normalize the captured key combination before comparison
            const normalizedKeyCombination = normalizeKeyCombination(keyCombination);

            const operation = currentKeyMappings[normalizedKeyCombination];
            if (operation) {
                operation();
                workflowHistory.prevKey = event.key.toLowerCase();
                workflowHistory.keyTimeout = setTimeout(
                    () => { workflowHistory.prevKey = null },
                    workflowHistory.time_to_next_operation_repeat()
                );
                workflowHistory.repKeyCount += 1;
            }
        });

        window.addEventListener("keyup", function (event) {
            if (event.key.toLowerCase() === workflowHistory.prevKey ||
                workflowHistory.prevKey === null) {
                clearTimeout(workflowHistory.keyTimeout);
                workflowHistory.prevKey = null;
                workflowHistory.repKeyCount = 0;
            }
        });

        const o_onBeforeChange = app.graph.onBeforeChange;
        app.graph.onBeforeChange = function (info) {
            o_onBeforeChange ? o_onBeforeChange.apply(this, arguments) : undefined;

            workflowHistory.b_count += 1;
            if (!workflowHistory.enabled) return;
            if (workflowHistory.b_count > 2) return; //avoid unnecessary spam

            workflowHistory.before();
        }

        const o_onAfterChange = app.graph.onAfterChange;
        app.graph.onAfterChange = function (info) {
            o_onAfterChange ? o_onAfterChange.apply(this, arguments) : undefined;

            workflowHistory.b_count -= 1;
            if (!workflowHistory.enabled) return;
            if (workflowHistory.b_count > 0) return; //same reasoning as in beforeChange

            workflowHistory.after();
        }
    }


    constructor() {
        // the following paramaters CAN BE TWEAKED
        this.max_undo_steps = 100; // the maximum number of undos that can be performed
        this.max_redo_steps = 100; // the maximum number of redos that can be performed
        this.state_merge_threshold = 100; // state merge threshold in milliseconds

        // DO NOT CHANGE THE VARIABLES BELOW
        //WorkflowHistory.WH = this;
        this.undo_history = [];
        this.redo_history = [];
        this.prev_undo_timestamp = 0; // timestamp of the last state pushed to the undo history
        this.setup_done = false;

        // auxiliary variables used by the nodes (to avoid data spam)
        this.temp_timestamp = 0;   //potential state to push to undo history
        this.temp_state = 0;

        this.disable_load_reset = false; //distinguish when a load is triggered by an undo/redo command, or by loading a new workflow
        this.between_onbefore_onafter = false; //ignores conection changes when true
        this.b_count = 0; // sums OnBeforeChange calls and subtracts OnAfterChange calls

        this.enabled = true;
        this.check_mouse_up = false;

        this.igraph = new LGraph() // auxiliary variable; used only by get_serialized_graph
    }


    /**
     * Updates the value of candidate state if enough time has passed since previous stored state.
     * @param {boolean} force  enforce a new candidate; use when sure there was a discrete interaction.
     */
    before(force = false) {
        if (!this.enabled) return;

        const timestamp = Date.now();

        if (!force) // a discrete interaction, ignore stamping and get new candidate
            if (
                (timestamp - this.prev_undo_timestamp < this.state_merge_threshold) || // a quick change, prob not done via discrite interaction
                (this.b_count >= 2) // onBeforeChange spam has been going on (and timestamp may not have been updated)
            ) {
                this.prev_undo_timestamp = timestamp;
                //console.log("merged") // will be kept the same
                return; //state is whithin the merge thesh and is discarded, don't do anything else
            }

        // potential state outside merge thresh. note that it is not guaranteed to be pushed        
        const p_candidate_state = { state: this.temp_state, timestamp: this.temp_timestamp }
        this.get_new_candidate_state(app);
        if (!this.equal_states(p_candidate_state.state, this.temp_state, true))
            this.tryAddToUndoHistory(p_candidate_state);
    }

    after() {
        if (!this.enabled) return;
        this.tryAddToUndoHistory();
    }


    /**
     * Will add potential_state to undo history if not equal to previously stored state.
     * 
     * If the state is successfully stored the redo history is cleaned.
     * @param {*} potential_state the state to try to add undo history in the format {state: ..., timestamp: ...}
     */
    tryAddToUndoHistory(potential_state = { state: this.temp_state, timestamp: this.timestamp }) {
        if (!this.enabled) return;

        if (this.undo_history.length > 0 && this.equal_states(potential_state.state, this.undo_history[0])) {
            //console.log("discarded potential undo state")
            return; //the new state is equal to prev stored state.
        }

        this.undo_history.unshift(potential_state.state);
        this.prev_undo_timestamp = potential_state.timestamp;

        if (this.undo_history.length > this.max_undo_steps)
            this.undo_history.pop();

        this.redo_history = []
    }

    undo(app) { this.undo_redo(app, false); }
    redo(app) { this.undo_redo(app, true); }


    /**
     * @param {ComfyApp} app 
     * @param {boolean} redo set to true to execute a redo; or false for a undo. 
     * @returns 
     */
    undo_redo(app, redo) {
        if (!this.enabled) return;

        let timeline = redo ? this.redo_history : this.undo_history;
        let opposite_timeline = redo ? this.undo_history : this.redo_history;
        let operation_name = redo ? "redo" : "undo";
        let max_opposite_timeline_size = redo ? this.max_undo_steps : this.max_redo_steps;

        if (timeline.length === 0) {
            console.log("Can't " + operation_name) //maybe alert instead?
            return;
        }

        this.disable_load_reset = true;

        const prev_state = timeline.shift();
        const current_state = this.get_serialized_graph(app.graph)

        opposite_timeline.unshift(current_state);
        if (opposite_timeline.length > max_opposite_timeline_size)
            opposite_timeline.pop();

        app.loadGraphData(JSON.parse(prev_state));
        this.get_new_candidate_state(app);
        this.disable_load_reset = false;
    }


    /**
     * 
     * @param {*} a json serialized LGraph
     * @param {*} b json serialized LGraph
     * @param {boolean} quick_n_dirty if set to true, will ONLY compare the graphs' lengths. 
     * @returns 
     */
    equal_states(a, b, quick_n_dirty = false) {
        return quick_n_dirty ? (a.length === b.length) : (a === b);
    }


    /**
    * @description
    * Returns a string of a serialized graph with the same links and nodes as the source LGraph, but no additional copied data.
    * 
    * The igraph is used for serialization.
    */
    get_serialized_graph(source) {
        this.igraph._nodes_by_id = this.igraph._nodes_in_order = null;
        this.igraph._nodes = Object.values(source._nodes_by_id);
        this.igraph.links = source.links;
        this.igraph.last_link_id = source.last_link_id;
        this.igraph.last_node_id = source.last_node_id;
        this.igraph._groups = source._groups;
        // TODO: is there anything else that should be stored?
        // TODO: if applicable, consider removing unneeded data in serialized object; then reintroduced it when loading
        return JSON.stringify(this.igraph.serialize(), null);
    }

    /**
     * @param {ComfyApp} app 
     */
    get_new_candidate_state(app) {
        this.temp_timestamp = Date.now();
        this.temp_state = this.get_serialized_graph(app.graph)
    }

    clean_history() {
        this.undo_history = [];
        this.redo_history = [];
    }

    /**
     * Computes the delay between each undo/redo operation when the key is held down.
     * @returns delay in milliseconds
     */
    time_to_next_operation_repeat() {
        const max_delay = 500;
        const min_delay = 30;
        const repeats_till_min_delay = 12;
        const rtmd_squared = repeats_till_min_delay * repeats_till_min_delay;

        return max_delay -
            (max_delay - min_delay) / rtmd_squared
            * Math.min(this.repKeyCount * this.repKeyCount, rtmd_squared);
    }

}

export const workflowHistory = new WorkflowHistory();
