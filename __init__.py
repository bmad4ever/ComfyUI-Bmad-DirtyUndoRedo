import os, shutil
import __main__

# remove old directory
extentions_folder = os.path.join(os.path.dirname(os.path.realpath(__main__.__file__)),
                                 "web" + os.sep + "extensions" + os.sep + "ZZZ-Bmad-DirtyUndoRedo")
if os.path.isdir(extentions_folder):
    shutil.rmtree(extentions_folder)

# set web dir
WEB_DIRECTORY = "js"
print('\033[92mBmad-DirtyUndoRedo Loaded.\033[0m')



