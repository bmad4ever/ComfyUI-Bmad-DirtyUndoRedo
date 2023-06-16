class WorkflowHistory {

    // STORES ENTIRE GRAPH STATE *NOT THE CHANGES !!!


    lock() { this.enabled = false; }
    release() { this.enabled = true; }
    isBetweenOnBeforeAndOnAfter() { return this.b_count > 0; }

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
        this.b_count = 0;

        this.enabled = true;


        this.setup = function (app) {
            if (this.setup_done) return;
            this.setup_done = true;
            app.wh = this;

            const o_onMouse = app.canvas.onMouse;
            app.canvas.onMouse = function () {
                const r = o_onMouse ? o_onMouse.apply(this, arguments) : undefined;

                if (!workflowHistory.enabled) return r;
                //console.log("onMouse");
                workflowHistory.before();

                return r;
            }

            const o__mouseup_callback = app.canvas._mouseup_callback;
            app.canvas._mouseup_callback = function (event) {
                const r = o__mouseup_callback ? o__mouseup_callback.apply(this, arguments) : undefined;

                if (!workflowHistory.enabled) return r;
                //console.log("_mouseup_callback");

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

            //app.graph.onConnectionChange // not needed apparently

            this.repKeyCount = 0;
            window.addEventListener("keydown", function (event) {
                if(workflowHistory.prevKey === event.key) return; //avoid quick auto spamm
                else if(workflowHistory.prevKey !== null) {
                    clearTimeout(workflowHistory.keyTimeout);
                    workflowHistory.repKeyCount=0;
                }
                
                if (event.ctrlKey) {
                    if (event.key === "z") {
                        workflowHistory.undo(app);
                        workflowHistory.prevKey = "z";
                        workflowHistory.keyTimeout = setTimeout(
                            ()=>{workflowHistory.prevKey=null}, 
                            workflowHistory.time_to_next_operation_repeat() 
                            );
                        workflowHistory.repKeyCount += 1;
                    }
                    if (event.key === "y") {
                        workflowHistory.redo(app);
                        workflowHistory.prevKey = "y";
                        workflowHistory.keyTimeout = setTimeout(
                            ()=>{workflowHistory.prevKey=null}, 
                            workflowHistory.time_to_next_operation_repeat() 
                            );
                        workflowHistory.repKeyCount += 1;
                    }
                }
            },);

            window.addEventListener("keyup", function (event) {
                if (event.key === workflowHistory.prevKey){
                    clearTimeout(workflowHistory.keyTimeout);
                    workflowHistory.prevKey=null;
                    workflowHistory.repKeyCount=0;
                }
            });

            const o_onBeforeChange = app.graph.onBeforeChange;
            app.graph.onBeforeChange = function (info) {
                o_onBeforeChange ? o_onBeforeChange.apply(this, arguments) : undefined;

                this.b_count += 1;
                if (!workflowHistory.enabled) return;
                if(this.b_count<2) return;//avoid unnecessary spam

                //console.log("beforeChange");
                workflowHistory.before();
            }

            const o_onAfterChange = app.graph.onAfterChange;
            app.graph.afterChange = function (info) {
                o_onAfterChange ? o_onAfterChange.apply(this, arguments) : undefined;

                this.b_count -= 1;
                if (!workflowHistory.enabled) return;
                if(this.b_count>0) return; //same reasoning as in beforeChange

                //console.log("afterChange");
                workflowHistory.after();
            }
        }
    }

    before() {
        if (!this.enabled) return;
        //console.log("before");

        const timestamp = Date.now();
        if (timestamp - this.prev_undo_timestamp < this.state_merge_threshold) {
            this.prev_undo_timestamp = timestamp;
            //console.log("merged") // will be kept the same
            return; //state is whithin the merge thesh and is discarded, don't do anything else
        }

        // potential state outside merge thresh. note that it is not guaranteed to be pushed        
        this.get_new_candidate_state(app);
    }

    after() {
        if (!this.enabled) return;
        //console.log("after");

        {
            // was there any change? if not, don't try to store the state
            // (this check is not guaranteed to work due to node order, but I am reordering nodes onSelected;
            //  so unless there are other operations that reorder nodes, it should be fine... I think)
            const equal = this.equal_states(JSON.stringify(app.graph.serialize(), null), this.temp_state);
            if (equal) return;
        }

        this.tryAddToUndoHistory();
    }

    tryAddToUndoHistory() {
        if (!this.enabled) return;

        const potential_new_state = this.temp_state;
        const timestamp = this.temp_timestamp;

        if (this.undo_history.length > 0 && this.equal_states(potential_new_state, this.undo_history[0])) {
            //console.log("discarded potential undo state")
            return; //the new state is equal to prev stored state.
        }

        //console.log("added state to undo history")
        this.undo_history.unshift(potential_new_state);
        this.prev_undo_timestamp = timestamp;

        if (this.undo_history.length > this.max_undo_steps)
            this.undo_history.pop();

        this.redo_history = []
    }

    undo(app) { this.undo_redo(app, false); }
    redo(app) { this.undo_redo(app, true); }

    undo_redo(app, redo) {
        if (!this.enabled) return;

        this.disable_load_reset = true;

        let timeline = redo ? this.redo_history : this.undo_history;
        let opposite_timeline = redo ? this.undo_history : this.redo_history;
        let operation_name = redo ? "redo" : "undo";
        let max_opposite_timeline_size = redo ? this.max_undo_steps : this.max_redo_steps;

        if (timeline.length === 0) {
            console.log("Can't " + operation_name) //maybe alert instead?
            return;
        }

        const prev_state = timeline.shift();
        const current_state = JSON.stringify(app.graph.serialize(), null);

        opposite_timeline.unshift(current_state);
        if (opposite_timeline.length > max_opposite_timeline_size)
            opposite_timeline.pop();

        app.loadGraphData(JSON.parse(prev_state));
        app.graph.setDirtyCanvas(true);

        this.get_new_candidate_state(app);

        this.disable_load_reset = false;
    }

    equal_states(a, b) {
        if (a.length === b.length) {
            return a.localeCompare(b) === 0;
        }
        return false;
    }

    get_new_candidate_state(app) {
        this.temp_timestamp = Date.now();
        this.temp_state = JSON.stringify(app.graph.serialize(), null);
    }

    clean_history() {
        this.undo_history = [];
        this.redo_history = [];
    }

    time_to_next_operation_repeat(){
        const max_delay = 500;
        const min_delay = 30;
        const repeats_till_min_delay = 12;
        const rtmd_squared = repeats_till_min_delay*repeats_till_min_delay;

        return max_delay - 
            (max_delay - min_delay)/rtmd_squared 
            * Math.min(this.repKeyCount*this.repKeyCount, rtmd_squared);
    }

}

export const workflowHistory = new WorkflowHistory();
