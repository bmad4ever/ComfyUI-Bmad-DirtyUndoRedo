# Bmad's Dirty Undo-Redo for [ComfyUI](https://github.com/comfyanonymous/ComfyUI)  


IMPORTANT: as of Nov 28, 2023 ComfyUI has the undo/redo functionality, thus making this extension obsolete.

After updating your local ComfyUI you will have to remove or disable the extension as it will conflict with the now existing functionality.

**To completely remove the extension you may need to delete the ZZZ-Bmad-DirtyUndoRedo inside the web/extensions directory. (the latest version of this extension will delete this folder after starting ComfyUI)**

__________________________________________________________________


ComfyUI extension that adds undo (and redo) functionality.

Undo: <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Z</kbd> 

Redo: <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Y</kbd> ; or <kbd>Ctrl</kbd>/<kbd>⌘</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>

Keeping the keys pressed will repeat the undo/redo operation at an ever-increased pace.

## Installation:

- Navigate to `/ComfyUI/custom_nodes/` folder;
- `git clone https://github.com/bmad4ever/ComfyUI-Bmad-DirtyUndoRedo`.

### Why "dirty"?

I was mainly concerned with getting a somewhat working solution quickly and not so much with implementing it "right". For example, the undo/redo data contains snapshots of the entire serialized workflow (this is overkill), and I'm not considering changing it.
