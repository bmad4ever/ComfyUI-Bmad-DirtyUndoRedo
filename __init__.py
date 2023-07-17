import os
import sys
import filecmp
import shutil

import __main__

python = sys.executable

NODE_CLASS_MAPPINGS = {}

extentions_folder = os.path.join(os.path.dirname(os.path.realpath(__main__.__file__)),
                                 "web" + os.sep + "extensions" + os.sep + "ZZZ-Bmad-DirtyUndoRedo")
javascript_folder = os.path.join(os.path.dirname(os.path.realpath(__file__)), "js")


if not os.path.exists(extentions_folder):
    os.mkdir(extentions_folder)

result = filecmp.dircmp(javascript_folder, extentions_folder)

if result.left_only or result.diff_files:
    file_list = list(result.left_only)
    file_list.extend(x for x in result.diff_files if x not in file_list)

    for file in file_list:
        src_file = os.path.join(javascript_folder, file)
        dst_file = os.path.join(extentions_folder, file)
        if os.path.exists(dst_file):
            os.remove(dst_file)
        shutil.copy(src_file, dst_file)

print('\033[92mBmad-DirtyUndoRedo Loaded.\033[0m')
