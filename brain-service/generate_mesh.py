"""
generate_mesh.py — Export fsaverage5 cortical mesh to JSON for Three.js.

Preferred: uses nilearn (real fsaverage5 from FreeSurfer).
Fallback:  generates a parametric icosphere with sulcal noise.

Output: ../public/brain/fsaverage5.json

Usage:
  python generate_mesh.py              # auto-detect
  python generate_mesh.py --real       # require nilearn (fails if not installed)
  python generate_mesh.py --parametric # force parametric fallback
"""

from __future__ import annotations
import argparse
import json
import math
import os
import sys
from pathlib import Path

OUT_PATH = Path(__file__).parent.parent / "public" / "brain" / "fsaverage5.json"


# ---------------------------------------------------------------------------
# Real mesh via nilearn
# ---------------------------------------------------------------------------

def build_real_mesh() -> dict:
    import nilearn.datasets as nld
    import nibabel as nib
    import numpy as np

    print("Fetching fsaverage5 from nilearn…")
    fsavg = nld.fetch_surf_fsaverage(mesh="fsaverage5")

    def load_hemi(surf_path: str):
        img = nib.load(surf_path)
        coords = img.darrays[0].data.tolist()   # (N, 3)
        faces  = img.darrays[1].data.tolist()   # (F, 3)
        return [[round(float(c), 4) for c in row] for row in coords], faces

    lh_v, lh_f = load_hemi(fsavg["pial_left"])
    rh_v, rh_f = load_hemi(fsavg["pial_right"])

    n_lh = len(lh_v)
    rh_f_shifted = [[f[0] + n_lh, f[1] + n_lh, f[2] + n_lh] for f in rh_f]

    return {
        "vertices": lh_v + rh_v,
        "faces": lh_f + rh_f_shifted,
        "hemisphere_split": n_lh,
        "source": "nilearn/fsaverage5",
    }


# ---------------------------------------------------------------------------
# Parametric fallback
# ---------------------------------------------------------------------------

def _norm(v: list[float]) -> list[float]:
    n = math.sqrt(sum(c**2 for c in v))
    return [c / n for c in v]


def icosphere(subdivisions: int = 4) -> tuple[list, list]:
    t = (1 + math.sqrt(5)) / 2
    verts: list[list[float]] = [_norm(v) for v in [
        [-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0],
        [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t],
        [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1],
    ]]
    faces = [
        [0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],
        [1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],
        [3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],
        [4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1],
    ]
    edge_map: dict[tuple[int, int], int] = {}

    def midpoint(a: int, b: int) -> int:
        key = (min(a, b), max(a, b))
        if key in edge_map:
            return edge_map[key]
        va, vb = verts[a], verts[b]
        m = _norm([(va[i] + vb[i]) / 2 for i in range(3)])
        verts.append(m)
        edge_map[key] = len(verts) - 1
        return edge_map[key]

    for _ in range(subdivisions):
        new_faces: list[list[int]] = []
        for tri in faces:
            a, b, c = tri
            ab = midpoint(a, b); bc = midpoint(b, c); ca = midpoint(c, a)
            new_faces += [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]
        faces = new_faces

    return verts, faces


def build_parametric_mesh() -> dict:
    print("Building parametric brain mesh…")
    verts, faces = icosphere(4)  # 2562 verts, 5120 faces per hemi

    def shape_hemisphere(verts: list, flip_x: bool) -> list:
        result = []
        for v in verts:
            x, y, z = v
            noise = 0.05 * math.sin(x * 8 + y * 6) + 0.03 * math.cos(z * 10 + x * 5)
            r = 1.0 + noise
            sx = -90.0 if flip_x else 90.0
            result.append([round(x * r * sx, 4), round(y * r * 70.0, 4), round(z * r * 75.0, 4)])
        return result

    lh_v = shape_hemisphere(verts, flip_x=False)
    rh_v = shape_hemisphere(verts, flip_x=True)
    n_lh = len(lh_v)
    rh_f = [[f[0] + n_lh, f[1] + n_lh, f[2] + n_lh] for f in faces]

    return {
        "vertices": lh_v + rh_v,
        "faces": faces + rh_f,
        "hemisphere_split": n_lh,
        "source": "parametric",
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser()
    group = parser.add_mutually_exclusive_group()
    group.add_argument("--real", action="store_true", help="Require real nilearn mesh")
    group.add_argument("--parametric", action="store_true", help="Force parametric fallback")
    args = parser.parse_args()

    if args.real:
        mesh = build_real_mesh()
    elif args.parametric:
        mesh = build_parametric_mesh()
    else:
        try:
            mesh = build_real_mesh()
        except Exception as exc:
            print(f"nilearn unavailable ({exc}) — using parametric fallback")
            mesh = build_parametric_mesh()

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(mesh, f, separators=(",", ":"))

    size_kb = OUT_PATH.stat().st_size // 1024
    print(
        f"Written {OUT_PATH}\n"
        f"  {len(mesh['vertices'])} vertices  |  {len(mesh['faces'])} faces  |  "
        f"{mesh['hemisphere_split']} verts/hemi  |  {size_kb} KB  |  source={mesh['source']}"
    )


if __name__ == "__main__":
    main()
