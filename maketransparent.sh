# gm is GraphicsMagick
# usage: ./maketransparent.sh whatever.bmp output.png
gm convert -type TrueColor -transparent 'rgb(11,0,11)' $1 $2
