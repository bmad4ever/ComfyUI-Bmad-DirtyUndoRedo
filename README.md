# Bmad's Dirty Undo-Redo for [ComfyUI](https://github.com/comfyanonymous/ComfyUI)  

ComfyUI extension that adds undo (and redo) functionality.

## Instalation:

- Navigate to `/ComfyUI/custom_nodes/` folder;
- `git clone git clone https://github.com/bmad4ever/ComfyUI-Bmad-DirtyUndoRedo`.


### Troubleshooting

This extension overrides some prototypes methods, but should keep the original behavior intact. Make sure this extension is the last to be loaded so that it affects all node types (web extensions appear to be loaded in alphabetic order with respect to their path). 


### Why "dirty"?

I was mainly concerned with getting a somewhat working solution quickly and not so much with implementing it "right". For example, the undo/redo data contains snapshots of the entire serialized workflow (this is overkill), and I'm not considering changing it.

