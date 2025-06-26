from flask import Flask, render_template, request, send_file, jsonify
from pathlib import Path
from datetime import datetime
from PIL import Image, ImageOps
import numpy as np
import base64
import io

app = Flask(__name__, static_folder='static')

# Buat folder simpan di Desktop
desktop = Path.home() / "Desktop"
save_dir = desktop / "photoboott" / "image"
save_dir.mkdir(parents=True, exist_ok=True)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/save-photo", methods=["POST"])
def save_photo():
    try:
        data = request.json.get("image")
        frame_name = request.json.get("frame")
        image_data = data.split(",")[1]

        # Path ke frame
        frame_path = Path("static/frames") / frame_name
        if not frame_path.exists():
            return jsonify({"error": "Frame tidak ditemukan"}), 404

        # Decode image base64 ke PIL Image
        img_bytes = base64.b64decode(image_data)
        user_img = Image.open(io.BytesIO(img_bytes)).convert("RGBA")

        # Buka dan resize frame
        frame_img = Image.open(frame_path).convert("RGBA")
        target_width, target_height = 1080, 1440
        frame_img = frame_img.resize((target_width, target_height), Image.LANCZOS)

        # Cari area transparan (lubang)
        alpha = np.array(frame_img.getchannel("A"))
        mask_transparent = alpha == 0
        ys, xs = np.where(mask_transparent)

        if len(xs) == 0 or len(ys) == 0:
            return jsonify({"error": "Frame tidak memiliki area transparan."}), 400

        # Hitung koordinat lubang
        hole_x, hole_y = xs.min(), ys.min()
        hole_r, hole_b = xs.max(), ys.max()
        hole_w, hole_h = hole_r - hole_x, hole_b - hole_y

        # Resize & crop gambar user agar pas ke lubang
        user_img_fitted = ImageOps.fit(user_img, (hole_w, hole_h), method=Image.LANCZOS, centering=(0.5, 0.5))

        # Tempelkan ke base dan gabung dengan frame
        base = Image.new("RGBA", (target_width, target_height), (255, 255, 255, 255))
        base.paste(user_img_fitted, (hole_x, hole_y), mask=user_img_fitted)
        final = Image.alpha_composite(base, frame_img)

        # Simpan ke buffer dan ke folder
        output = io.BytesIO()
        final.save(output, format="PNG")
        output.seek(0)

        filename = f"photo_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
        full_path = save_dir / filename
        with open(full_path, "wb") as f:
            f.write(output.getvalue())

        return send_file(output, mimetype="image/png")

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
