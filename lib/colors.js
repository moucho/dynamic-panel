import GdkPixbuf from "gi://GdkPixbuf";
import St from "gi://St";
import Gio from 'gi://Gio';
import * as Main from "resource:///org/gnome/shell/ui/main.js";
export default class Colors {
    static rgbToHsl(r, g, b) {
        r /= 255, g /= 255, b /= 255;
        let max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;

        if (max == min) {
            h = s = 0; // achromatic
        } else {
            let d = max - min;
            s = l > 0
            .5 ? d / (2 - max - min) : d / (max + min);
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break;
                case g: h = (b - r) / d + 2; break;
                case b: h = (r - g) / d + 4; break;
            }
            h /= 6;
        }

        return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
    }
    static hslToRgb(h, s, l) {
        // 確保 hsl 值在有效範圍內
        h = Math.max(0, Math.min(360, h));
        s = Math.max(0, Math.min(100, s));
        l = Math.max(0, Math.min(100, l));

        // 将 hsl 值转换为 0-1 范围
        h /= 360;
        s /= 100;
        l /= 100;

        let r, g, b;

        if (s === 0) {
            r = g = b = l; // achromatic
        } else {
            const hue2rgb = (p, q, t) => {
                if (t < 0) t += 1;
                if (t > 1) t -= 1;
                if (t < 1 / 6) return p + (q - p) * 6 * t;
                if (t < 1 / 2) return q;
                if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
                return p;
            };

            const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
            const p = 2 * l - q;
            r = hue2rgb(p, q, h + 1 / 3);
            g = hue2rgb(p, q, h);
            b = hue2rgb(p, q, h - 1 / 3);
        }

        return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
    }
    static getCustomColor(settings) {
        let D_BGC = settings.get_string('dark-bg-color');
        let D_FGC = settings.get_string('dark-fg-color');
        let L_BGC = settings.get_string('light-bg-color');
        let L_FGC = settings.get_string('light-fg-color');
        D_BGC = D_BGC.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        D_FGC = D_FGC.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        L_BGC = L_BGC.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        L_FGC = L_FGC.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
        return [
            {
                dark: {
                    r: D_BGC[1],
                    g: D_BGC[2],
                    b: D_BGC[3]
                },
                light: {
                    r: L_BGC[1],
                    g: L_BGC[2],
                    b: L_BGC[3]
                }
            },
            {
                dark: {
                    r: D_FGC[1],
                    g: D_FGC[2],
                    b: D_FGC[3]
                },
                light: {
                    r: L_FGC[1],
                    g: L_FGC[2],
                    b: L_FGC[3]
                }
            }
        ]
    }
    static getThemeColor(imagePath, modifier) {
        const source = GdkPixbuf.Pixbuf.new_from_file(imagePath);
        const pixels = source.get_pixels();
        const rowstride = source.get_rowstride();
        const n_channels = source.get_n_channels();
        const centerX = Math.round(source.get_width() / 2);
        const centerY = Math.round(source.get_height() / 2);
        const H = source.get_height();
        const W = source.get_width();
        const colors = new Map();
        for (let y = 0; y < H; y += Math.round(H / 100)) {
            for (let x = 0; x < W; x += Math.round(W / 100)) {
                // 計算像素在陣列中的偏移量
                const offset = y * rowstride + x * n_channels;

                // 取得像素的顏色分量
                const r = pixels[offset];
                const g = pixels[offset + 1];
                const b = pixels[offset + 2];
                const strRGB = [r, g, b].join(",");

                const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));

                // 計算最大距離
                const maxDistance = Math.sqrt(Math.pow(W / 2, 2) + Math.pow(H / 2, 2));

                // 使用高斯函數計算權重
                // 這裡使用標準差為最大距離的 1/4，您可以根據需要調整
                const sigma = maxDistance / 4;
                const weight = Math.exp(-(Math.pow(distance, 2) / (2 * Math.pow(sigma, 2))));

                const addValue = 1 * weight;

                if (colors.has(strRGB)) {
                    colors.set(strRGB, colors.get(strRGB) + addValue);
                } else {
                    colors.set(strRGB, addValue);
                }
            }
        }
        const entries = Array.from(colors.entries());
        entries.sort((a, b) => b[1] - a[1]);
        let hslC = Colors.rgbToHsl(...entries[0][0].split(/\s*,\s*/).map(Number));
        if (modifier == "light") {
            hslC[2] = 60;
        } else {
            hslC[2] = 30;
        }
        return Colors.hslToRgb(...hslC);
    }

    static gaussianBlur(settings, imagePath, radius = 30) {
        let pixbuf = GdkPixbuf.Pixbuf.new_from_file(imagePath);
        const scale = St.ThemeContext.get_for_stage(global.stage).scale_factor;
        const panelHeight = Main.panel.get_height();
        const maxHeight = (settings.get_int("top-margin") + panelHeight + 5) * scale;

        let command = ['/usr/bin/gsettings', 'get', 'org.gnome.desktop.background', 'picture-options']; // 定义 gsettings 命令
        let wallpaperMode = 'zoom';
        try {
            const proc = Gio.Subprocess.new(command,
                Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);

            const [ok, stdout, stderr] = proc.communicate_utf8(null, null);

            if (ok) {
                wallpaperMode = stdout.trim().replaceAll("'", '');
            }
            else
                throw new Error(stderr);
        } catch (e) {
            logError(e);
        }

        const screenWidth = Main.layoutManager.primaryMonitor.width;
        const screenHeight = Main.layoutManager.primaryMonitor.height;
        let imageWidth = pixbuf.get_width();
        let imageHeight = pixbuf.get_height();
        let imageAspectRatio = imageWidth / imageHeight;
        let screenAspectRatio = screenWidth / screenHeight;
        let startX = 0;
        let startY = 0;

        switch (wallpaperMode) {
            case "zoom": // 放大并裁剪
                if (imageAspectRatio > screenAspectRatio) {
                    // 图片更宽，左右两侧被裁剪，水平方向偏移 (X 轴)
                    startX = Math.round((imageWidth - (imageHeight * screenAspectRatio)) / 2); // 计算图片 X 方向的偏移量
                } else {
                    // 图片更高或比例相同，上下两侧被裁剪，垂直方向偏移 (Y 轴)
                    startY = Math.round((imageHeight - (imageWidth / screenAspectRatio)) / 2); // 计算图片 Y 方向的偏移量
                }
                break;
            case "centered": // 居中
            case "scaled": // 缩放
            case "stretched": // 拉伸
            case "wallpaper": // 壁纸 (Centered and Tiled) -  假设 Centered
            case "spanned": // 跨屏 - 假设 Scaled
            case "none": // 无
            default:
                startX = 0;
                startY = 0;
                break;
        }

        pixbuf = pixbuf.new_subpixbuf(startX, startY, imageWidth, Math.round(imageWidth / (screenWidth / maxHeight)));

        let pixbuf_fill = GdkPixbuf.Pixbuf.new(GdkPixbuf.Colorspace.RGB, pixbuf.get_has_alpha(), 8, pixbuf.get_width(), pixbuf.get_height() + 20);
        pixbuf.copy_area(0, 0, pixbuf.get_width(), pixbuf.get_height(), pixbuf_fill, 0, 0);
        pixbuf.copy_area(0, 0, pixbuf.get_width(), pixbuf.get_height(), pixbuf_fill, 0, 20);
        pixbuf = pixbuf_fill;


        let width = pixbuf.get_width();
        let height = pixbuf.get_height();
        let hasAlpha = pixbuf.get_has_alpha();
        let rowstride = pixbuf.get_rowstride();
        let pixels = pixbuf.get_pixels();
        // let newPixels = new Uint8Array(pixels.length); //Change to Float32Array

        // 生成高斯核 (预先计算, 并优化)
        let kernel = [];
        let sigma = radius / 3;
        let sum = 0;
        for (let x = -radius; x <= radius; x++) {
            let g = Math.exp(-(x * x) / (2 * sigma * sigma));
            kernel.push(g);
            sum += g;
        }
        // 歸一化
        for (let i = 0; i < kernel.length; i++) {
            kernel[i] /= sum;
        }

        // 使用 Float32Array 存储中间结果
        let newPixels = new Float32Array(pixels.length);

        // 水平方向模糊
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0, a = 0;
                for (let i = -radius; i <= radius; i++) {
                    // 复制边界
                    let x1 = x + i;
                    if (x1 < 0) {
                        x1 = 0;
                    } else if (x1 >= width) {
                        x1 = width - 1;
                    }
                    let offset = (y * rowstride) + (x1 * (hasAlpha ? 4 : 3));
                    r += pixels[offset] * kernel[i + radius];
                    g += pixels[offset + 1] * kernel[i + radius];
                    b += pixels[offset + 2] * kernel[i + radius];
                    if (hasAlpha) {
                        a += pixels[offset + 3] * kernel[i + radius];
                    }
                }
                let offset = (y * rowstride) + (x * (hasAlpha ? 4 : 3));
                newPixels[offset] = r; // 存储 Float32 值
                newPixels[offset + 1] = g;
                newPixels[offset + 2] = b;
                if (hasAlpha) {
                    newPixels[offset + 3] = a;
                }
            }
        }

        // 垂直方向模糊 (复用 newPixels, 先复制)

        let tempPixels = new Float32Array(newPixels); // 复制水平模糊后的结果
        newPixels = new Float32Array(pixels.length);


        for (let x = 0; x < width; x++) {
            for (let y = 0; y < height; y++) {
                let r = 0, g = 0, b = 0, a = 0;
                for (let i = -radius; i <= radius; i++) {
                    // 复制边界
                    let y1 = y + i;
                    if (y1 < 0) {
                        y1 = 0;
                    } else if (y1 >= height) {
                        y1 = height - 1;
                    }
                    let offset = (y1 * rowstride) + (x * (hasAlpha ? 4 : 3));
                    r += tempPixels[offset] * kernel[i + radius];
                    g += tempPixels[offset + 1] * kernel[i + radius];
                    b += tempPixels[offset + 2] * kernel[i + radius];
                    if (hasAlpha) {
                        a += tempPixels[offset + 3] * kernel[i + radius];
                    }
                }
                let offset = (y * rowstride) + (x * (hasAlpha ? 4 : 3));
                newPixels[offset] = r; // 存储 Float32 值
                newPixels[offset + 1] = g;
                newPixels[offset + 2] = b;
                if (hasAlpha) {
                    newPixels[offset + 3] = a;
                }
            }
        }

        // 转换回 Uint8Array 并创建新的 Pixbuf
        let finalPixels = new Uint8Array(newPixels.length);
        for (let i = 0; i < newPixels.length; i++) {
            finalPixels[i] = Math.max(0, Math.min(255, Math.round(newPixels[i]))); // 截断并取整
        }

        let newPixbuf = GdkPixbuf.Pixbuf.new_from_data(
            finalPixels,
            GdkPixbuf.Colorspace.RGB,
            hasAlpha,
            8,
            width,
            height,
            rowstride,
            null,
            null
        );

        return newPixbuf;
    }

    static colorMix(color = { r: 0, g: 0, b: 0, a: 0.5 }, imagePath = "/tmp/vel-dynamic-panel-blurred-bg.jpg") {
        let pixbuf = GdkPixbuf.Pixbuf.new_from_file(imagePath);
        let width = pixbuf.get_width();
        let height = pixbuf.get_height();
        let hasAlpha = pixbuf.get_has_alpha();
        let rowstride = pixbuf.get_rowstride();
        let pixels = pixbuf.get_pixels();
        let newPixels = new Uint8Array(pixels.length);

        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r, g, b, a = 0;
                let offset = (y * rowstride) + (x * (hasAlpha ? 4 : 3));

                r = pixels[offset];
                g = pixels[offset + 1];
                b = pixels[offset + 2];
                if (hasAlpha) {
                    a = pixels[offset + 3];
                }

                // 混合顏色，這裡使用簡單的 alpha 混合
                r = (1 - color.a) * r + (color.a * color.r);
                g = (1 - color.a) * g + (color.a * color.g);
                b = (1 - color.a) * b + (color.a * color.b);

                newPixels[offset] = Math.round(r);
                newPixels[offset + 1] = Math.round(g);
                newPixels[offset + 2] = Math.round(b);
                if (hasAlpha) {
                    newPixels[offset + 3] = Math.round(a);
                }
            }
        }

        let newPixbuf = GdkPixbuf.Pixbuf.new_from_data(
            newPixels,
            GdkPixbuf.Colorspace.RGB,
            hasAlpha,
            8,
            width,
            height,
            rowstride,
            null,
            null
        );

        return newPixbuf
    }
}