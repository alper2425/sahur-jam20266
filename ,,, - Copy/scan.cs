using System;
using System.Drawing;
using System.Collections.Generic;

public class ImageScanner {
    public static void Scan(string path) {
        Console.WriteLine("Scanning " + path + "...");
        Bitmap bmp = new Bitmap(path);
        bool[,] visitedRed = new bool[bmp.Width, bmp.Height];
        bool[,] visitedPurple = new bool[bmp.Width, bmp.Height];
        
        List<Rectangle> reds = new List<Rectangle>();
        List<Rectangle> purples = new List<Rectangle>();

        for(int y=0; y<bmp.Height; y++){
            for(int x=0; x<bmp.Width; x++){
                Color c = bmp.GetPixel(x, y);
                
                // Red: dominant red
                if(c.R > 120 && c.R > c.G + 40 && c.R > c.B + 40 && c.A > 50 && !visitedRed[x,y]) {
                    Rectangle r = FloodFill(bmp, visitedRed, x, y, 0); 
                    if (r.Width > 4 && r.Height > 4) reds.Add(r);
                }
                
                // Purple: mix of red and blue, little green
                if(c.R > 130 && c.B > 130 && c.G < 110 && Math.Abs(c.R - c.B) < 70 && c.A > 50 && !visitedPurple[x,y]) {
                    Rectangle r = FloodFill(bmp, visitedPurple, x, y, 1); 
                    if (r.Width > 4 && r.Height > 4) purples.Add(r);
                }
            }
        }
        
        Console.WriteLine("---REDS---");
        foreach(var r in reds) Console.WriteLine(string.Format("{0},{1},{2},{3}", r.X, r.Y, r.Width, r.Height));
        Console.WriteLine("---PURPLES---");
        foreach(var p in purples) Console.WriteLine(string.Format("{0},{1},{2},{3}", p.X, p.Y, p.Width, p.Height));
    }

    static Rectangle FloodFill(Bitmap bmp, bool[,] visited, int startX, int startY, int type) {
        int minX = startX, maxX = startX;
        int minY = startY, maxY = startY;
        Queue<Point> q = new Queue<Point>();
        q.Enqueue(new Point(startX, startY));
        visited[startX, startY] = true;

        while(q.Count > 0){
            Point p = q.Dequeue();
            if(p.X < minX) minX = p.X;
            if(p.X > maxX) maxX = p.X;
            if(p.Y < minY) minY = p.Y;
            if(p.Y > maxY) maxY = p.Y;

            // neighbors
            Point[] n = new Point[]{
                new Point(p.X+1, p.Y), new Point(p.X-1, p.Y),
                new Point(p.X, p.Y+1), new Point(p.X, p.Y-1)
            };
            foreach(Point pt in n){
                if(pt.X>=0 && pt.X<bmp.Width && pt.Y>=0 && pt.Y<bmp.Height && !visited[pt.X, pt.Y]){
                    Color c = bmp.GetPixel(pt.X, pt.Y);
                    bool match = false;
                    
                    if(c.A > 30) {
                        if(type == 0 && c.R > 100 && c.R > c.G + 30 && c.R > c.B + 30) match = true;
                        if(type == 1 && c.R > 100 && c.B > 100 && c.G < 120 && Math.Abs(c.R - c.B) < 100) match = true;
                    }

                    if(match){
                        visited[pt.X, pt.Y] = true;
                        q.Enqueue(pt);
                    }
                }
            }
        }
        return new Rectangle(minX, minY, maxX - minX + 1, maxY - minY + 1);
    }
}
