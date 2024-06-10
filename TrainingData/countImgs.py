from glob import glob

for dir in glob("./imgs/*/", recursive = True):
    print(dir.split('\\')[1], len(glob(dir + "*.png")))