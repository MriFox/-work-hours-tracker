#!/usr/bin/env bash
# 一键出包：同步 web 资源 → 构建签名 release APK → 校验签名 → 输出到 release/
#
# 用法：bash scripts/build-apk.sh [版本号]
#   版本号可省略，省略时读 package.json 的 version 字段（如 0.12.2）
#
# ⚠️ 只在用户明确确认可以出包后运行。日常改完源码不要跑这个脚本。
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

JAVA_HOME="${JAVA_HOME:-D:\\Android Studio\\jbr}"
ANDROID_HOME="${ANDROID_HOME:-D:\\Android\\Sdk}"
BUILD_TOOLS="$ANDROID_HOME/build-tools/35.0.0"
NODE_DIR="/c/Users/ADMIN/.workbuddy/binaries/node/versions/22.22.2-6"
PY="/c/Users/ADMIN/.workbuddy/binaries/python/envs/default/Scripts/python.exe"

export JAVA_HOME ANDROID_HOME
export PATH="$NODE_DIR:$JAVA_HOME/bin:$PATH"

VER="${1:-$("$PY" -c "import json;print(json.load(open('package.json',encoding='utf-8'))['version'])")}"
echo "==> 打包版本 v$VER"

# ── 1) 同步 www ────────────────────────────────────────────────────────────
echo "==> 同步 www/"
rm -rf www && mkdir -p www
cp -r index.html manifest.json sw.js js css icons favicon.ico www/
for f in index.html manifest.json sw.js favicon.ico; do diff -q "$f" "www/$f" >/dev/null; done
diff -rq js www/js >/dev/null
diff -rq css www/css >/dev/null
diff -rq icons www/icons >/dev/null
echo "    www/ 与源码一致"

# ── 2) 静态资源清单存在性（任一 404 会让 SW 装不上）────────────────────────
"$PY" - <<'PYEOF'
import re, os, sys
s = open('sw.js', encoding='utf-8').read()
b = s[s.index('STATIC_ASSETS'):s.index('];', s.index('STATIC_ASSETS'))]
paths = re.findall(r"'\./([^']+)'", b)
bad = [p for p in paths if p and not os.path.exists(p)]
print('    STATIC_ASSETS %d 项，缺失 %d' % (len(paths), len(bad)))
if bad:
    print('    ❌ 缺失:', bad); sys.exit(1)
PYEOF

# ── 3) cap sync + 构建 ────────────────────────────────────────────────────
echo "==> cap sync"
npx cap sync android >/dev/null 2>&1 || true      # 已知会报 EPERM，资源同步实际成功
# 兜底再手工同步一次，确保万无一失
cp index.html manifest.json sw.js favicon.ico android/app/src/main/assets/public/
cp -r icons/. android/app/src/main/assets/public/icons/
cp -r js/.    android/app/src/main/assets/public/js/
cp -r css/.   android/app/src/main/assets/public/css/
diff -rq js android/app/src/main/assets/public/js >/dev/null
diff -q  sw.js android/app/src/main/assets/public/sw.js >/dev/null
echo "    assets/public 与源码一致"

echo "==> gradle assembleRelease"
( cd android && ./gradlew assembleRelease --no-daemon -q )

APK_SRC="android/app/build/outputs/apk/release/app-release.apk"
[ -f "$APK_SRC" ] || { echo "❌ 未产出 APK"; exit 1; }

# ── 4) 校验签名必须与历史版本一致（否则老用户无法覆盖安装）────────────────
echo "==> 校验签名"
NEW_FP="$("$BUILD_TOOLS/apksigner.bat" verify --print-certs "$APK_SRC" 2>/dev/null \
          | grep 'certificate SHA-256 digest' | awk '{print $NF}')"
HIST="D:/MiMoProjects/工时记录-v0.5.8.apk"
if [ -f "$HIST" ]; then
  OLD_FP="$("$BUILD_TOOLS/apksigner.bat" verify --print-certs "$HIST" 2>/dev/null \
            | grep 'certificate SHA-256 digest' | awk '{print $NF}')"
  if [ "$NEW_FP" = "$OLD_FP" ]; then
    echo "    ✅ 与历史版本一致（$NEW_FP）→ 可覆盖安装，数据保留"
  else
    echo "    ❌ 与历史版本不一致！"
    echo "       历史: $OLD_FP"
    echo "       本次: $NEW_FP"
    echo "       继续发布会迫使老用户卸载重装并丢失数据。请检查 android/keystore.properties"
    exit 1
  fi
else
  echo "    （未找到历史包，跳过比对）本次指纹: $NEW_FP"
fi

# ── 5) 输出 ───────────────────────────────────────────────────────────────
mkdir -p release
OUT="release/牛马计时器-v$VER.apk"
cp "$APK_SRC" "$OUT"
"$PY" -c "
import hashlib, os, sys
p = sys.argv[1]
h = hashlib.sha256(open(p,'rb').read()).hexdigest()
open(p + '.sha256','w').write('%s  %s\n' % (h, os.path.basename(p)))
print('    %s  %.2f MB' % (p, os.path.getsize(p)/1024/1024))
print('    SHA256 %s' % h)
" "$OUT"

echo
echo "✅ 出包完成：$OUT"
echo "   （旧的 release/*.apk 不自动删除，需要时手动清理）"
