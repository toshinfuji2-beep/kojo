// 画面の高さの決め方（main.js の fitApp が使う。DOM にさわらない計算だけ）
// o = { ih: innerHeight, vh: visualViewport の高さ+offsetTop（無ければ ih）, ph: 画面いっぱいの目印の高さ, de: clientHeight, sa: ホーム画面アプリか, sw, sh: screen の幅・高さ, land: 今の向きが横か, kb: 文字を打っている（キーボードが出ている）か }
// ph（画面いっぱいの目印の高さ）・de（clientHeight）は使わない：環境によって、実際に見えている高さより小さい値を返し（例 393 の画面で 264）、画面が縮んで下が空く原因になったため（2026-11-22）
export function fitCalc(o) {
  let h = Math.round(Math.min(o.ih, o.vh || o.ih));
  if (o.sa && o.sw && o.sh) {
    const cap = o.land ? Math.min(o.sw, o.sh) : Math.max(o.sw, o.sh);
    if (h > cap + 1) h = cap;   // 古い向きの高さのまま（大きすぎ）→ この向きの最大の高さにおさえる
    // 逆に小さすぎ：横向きのホーム画面アプリは、画面の高さ＝screen の短い辺（上のバーが無い）。回転しながら開くと、レイアウトが前の向きの小さい高さのまま残り、
    // 画面の下が空く（ユーザーのスクショで、全体が上 85% に縮んで下がうす黄色）。キーボードが出ていないのに 24px 以上小さいときは、画面の高さまで広げる
    else if (o.land && !o.kb && h < cap - 24) h = cap;
  }
  return h;
}
