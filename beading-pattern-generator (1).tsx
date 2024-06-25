import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const BeadingPatternGenerator = () => {
  const [image, setImage] = useState(null);
  const [patternStyle, setPatternStyle] = useState('peyote');
  const [beadCount, setBeadCount] = useState(10);
  const [colorCount, setColorCount] = useState(5);
  const [pattern, setPattern] = useState([]);
  const [colorLegend, setColorLegend] = useState({});
  const canvasRef = useRef(null);

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    const reader = new FileReader();
    reader.onload = (event) => {
      setImage(event.target.result);
    };
    reader.readAsDataURL(file);
  };

  const kMeansColorReduction = (pixels, k, maxIterations = 20) => {
    // Initialize centroids randomly
    let centroids = Array(k).fill().map(() => [
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256),
      Math.floor(Math.random() * 256)
    ]);

    for (let iteration = 0; iteration < maxIterations; iteration++) {
      // Assign pixels to nearest centroid
      const assignments = [];
      for (let i = 0; i < pixels.length; i += 4) {
        const pixel = [pixels[i], pixels[i + 1], pixels[i + 2]];
        let minDistance = Infinity;
        let assignment = 0;
        for (let j = 0; j < k; j++) {
          const distance = Math.sqrt(
            Math.pow(pixel[0] - centroids[j][0], 2) +
            Math.pow(pixel[1] - centroids[j][1], 2) +
            Math.pow(pixel[2] - centroids[j][2], 2)
          );
          if (distance < minDistance) {
            minDistance = distance;
            assignment = j;
          }
        }
        assignments.push(assignment);
      }

      // Update centroids
      const newCentroids = Array(k).fill().map(() => [0, 0, 0]);
      const counts = Array(k).fill(0);
      for (let i = 0; i < assignments.length; i++) {
        const assignment = assignments[i];
        newCentroids[assignment][0] += pixels[i * 4];
        newCentroids[assignment][1] += pixels[i * 4 + 1];
        newCentroids[assignment][2] += pixels[i * 4 + 2];
        counts[assignment]++;
      }

      for (let i = 0; i < k; i++) {
        if (counts[i] > 0) {
          newCentroids[i] = newCentroids[i].map(sum => Math.round(sum / counts[i]));
        }
      }

      // Check for convergence
      if (JSON.stringify(centroids) === JSON.stringify(newCentroids)) {
        break;
      }
      centroids = newCentroids;
    }

    return centroids;
  };

  const generatePattern = () => {
    if (!image) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = beadCount;
      canvas.height = Math.floor((beadCount * img.height) / img.width);

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const reducedColors = kMeansColorReduction(data, colorCount);

      const newPattern = [];
      const newColorLegend = {};
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

      reducedColors.forEach((color, index) => {
        const colorKey = `rgb(${color.join(',')})`;
        newColorLegend[colorKey] = letters[index % letters.length];
      });

      for (let y = 0; y < canvas.height; y++) {
        const row = [];
        for (let x = 0; x < canvas.width; x++) {
          const i = (y * canvas.width + x) * 4;
          const pixel = [data[i], data[i + 1], data[i + 2]];
          let nearestColor = reducedColors[0];
          let minDistance = Infinity;

          for (const color of reducedColors) {
            const distance = Math.sqrt(
              Math.pow(pixel[0] - color[0], 2) +
              Math.pow(pixel[1] - color[1], 2) +
              Math.pow(pixel[2] - color[2], 2)
            );

            if (distance < minDistance) {
              minDistance = distance;
              nearestColor = color;
            }
          }

          const colorKey = `rgb(${nearestColor.join(',')})`;
          row.push(colorKey);
        }
        newPattern.push(row);
      }

      setPattern(newPattern);
      setColorLegend(newColorLegend);
    };
    img.src = image;
  };

  const getContrastColor = (rgb) => {
    const [r, g, b] = rgb.match(/\d+/g).map(Number);
    const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
  };

  const renderPeyotePattern = () => {
    return (
      <div className="grid gap-px" style={{ width: 'fit-content' }}>
        {pattern.map((row, rowIndex) => (
          <div key={rowIndex} className="flex" style={{ marginLeft: rowIndex % 2 === 1 ? '0.75rem' : '0' }}>
            {row.map((color, colIndex) => (
              <div
                key={`${rowIndex}-${colIndex}`}
                className="w-6 h-6 flex items-center justify-center text-xs font-bold"
                style={{
                  backgroundColor: color,
                  color: getContrastColor(color),
                  clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                  margin: '-0.1rem',
                }}
              >
                {colorLegend[color]}
              </div>
            ))}
          </div>
        ))}
      </div>
    );
  };

  const renderPatternToCanvas = () => {
    if (!canvasRef.current || pattern.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const beadSize = 20;
    const margin = 5;

    canvas.width = pattern[0].length * beadSize + margin * 2;
    canvas.height = pattern.length * beadSize + margin * 2;

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (patternStyle === 'peyote') {
      pattern.forEach((row, rowIndex) => {
        row.forEach((color, colIndex) => {
          ctx.beginPath();
          const centerX = colIndex * beadSize + beadSize / 2 + margin + (rowIndex % 2 === 1 ? beadSize / 2 : 0);
          const centerY = rowIndex * beadSize + beadSize / 2 + margin;
          ctx.moveTo(centerX, centerY - beadSize / 2);
          for (let i = 1; i <= 6; i++) {
            const angle = i * Math.PI / 3;
            ctx.lineTo(centerX + Math.sin(angle) * beadSize / 2, centerY - Math.cos(angle) * beadSize / 2);
          }
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.stroke();

          ctx.fillStyle = getContrastColor(color);
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(colorLegend[color], centerX, centerY);
        });
      });
    } else {
      pattern.forEach((row, rowIndex) => {
        row.forEach((color, colIndex) => {
          ctx.fillStyle = color;
          ctx.fillRect(colIndex * beadSize + margin, rowIndex * beadSize + margin, beadSize, beadSize);
          ctx.strokeStyle = 'rgba(0,0,0,0.2)';
          ctx.strokeRect(colIndex * beadSize + margin, rowIndex * beadSize + margin, beadSize, beadSize);

          ctx.fillStyle = getContrastColor(color);
          ctx.font = '10px Arial';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(colorLegend[color], colIndex * beadSize + beadSize / 2 + margin, rowIndex * beadSize + beadSize / 2 + margin);
        });
      });
    }

    // Render color legend
    const legendY = pattern.length * beadSize + margin * 2;
    ctx.fillStyle = 'black';
    ctx.font = '14px Arial';
    ctx.textAlign = 'left';
    ctx.fillText('Color Legend:', margin, legendY);

    Object.entries(colorLegend).forEach(([color, letter], index) => {
      const x = margin + (index % 5) * (canvas.width / 5);
      const y = legendY + 20 + Math.floor(index / 5) * 25;

      ctx.fillStyle = color;
      ctx.fillRect(x, y, 20, 20);
      ctx.strokeStyle = 'black';
      ctx.strokeRect(x, y, 20, 20);

      ctx.fillStyle = 'black';
      ctx.fillText(`${letter}: ${color}`, x + 25, y + 15);
    });
  };

  const saveAsPNG = () => {
    if (!canvasRef.current) return;

    renderPatternToCanvas();

    const link = document.createElement('a');
    link.download = 'beading_pattern.png';
    link.href = canvasRef.current.toDataURL('image/png');
    link.click();
  };

  useEffect(() => {
    if (pattern.length > 0) {
      renderPatternToCanvas();
    }
  }, [pattern, patternStyle]);

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Beading Pattern Generator</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div>
            <Label htmlFor="image-upload">Upload Image</Label>
            <Input id="image-upload" type="file" accept="image/*" onChange={handleImageUpload} />
          </div>
          <div>
            <Label htmlFor="pattern-style">Pattern Style</Label>
            <Select value={patternStyle} onValueChange={setPatternStyle}>
              <SelectTrigger id="pattern-style">
                <SelectValue placeholder="Select pattern style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="peyote">Peyote</SelectItem>
                <SelectItem value="loom">Loom</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="bead-count">Number of Beads (X-axis)</Label>
            <Input
              id="bead-count"
              type="number"
              value={beadCount}
              onChange={(e) => setBeadCount(parseInt(e.target.value))}
              min="1"
            />
          </div>
          <div>
            <Label htmlFor="color-count">Number of Colors</Label>
            <Input
              id="color-count"
              type="number"
              value={colorCount}
              onChange={(e) => setColorCount(parseInt(e.target.value))}
              min="1"
              max="26"
            />
          </div>
          <Button onClick={generatePattern}>Generate Pattern</Button>
        </div>
        {pattern.length > 0 && (
          <div className="mt-4">
            <h3 className="text-lg font-semibold mb-2">Generated Pattern:</h3>
            {patternStyle === 'peyote' ? renderPeyotePattern() : (
              <div
                className="grid gap-px"
                style={{
                  gridTemplateColumns: `repeat(${beadCount}, 1fr)`,
                }}
              >
                {pattern.flat().map((color, index) => (
                  <div
                    key={index}
                    className="w-6 h-6 flex items-center justify-center text-xs font-bold"
                    style={{ 
                      backgroundColor: color,
                      color: getContrastColor(color)
                    }}
                  >
                    {colorLegend[color]}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4">
              <h4 className="text-md font-semibold mb-2">Color Legend:</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(colorLegend).map(([color, letter]) => (
                  <div key={color} className="flex items-center">
                    <div
                      className="w-6 h-6 mr-1 border border-gray-300"
                      style={{ backgroundColor: color }}
                    ></div>
                    <span>{letter}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <Button onClick={saveAsPNG}>Save as PNG</Button>
              <canvas ref={canvasRef} style={{ display: 'none' }} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default BeadingPatternGenerator;
