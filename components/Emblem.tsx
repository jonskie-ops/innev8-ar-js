// The INNEV8 emblem, built from the main site's IntroEmblem + Sprite (innev8-nextjs/components/graphics.tsx).
// Edit with care: the splash CSS targets these class names.
import type { CSSProperties } from "react";

export function Emblem() {
  return (
    <svg className="i8e" viewBox="211 72 727 1123" role="img" aria-label="INNEV8">
      <defs>
        <linearGradient id="i8-gb" gradientUnits="userSpaceOnUse" x1="0" y1="72" x2="0" y2="1195">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#9ae8ff" />
        </linearGradient>
        <linearGradient id="i8-gr" gradientUnits="userSpaceOnUse" x1="691.6" y1="804.4" x2="921.4" y2="974.0">
          <stop offset="0" stopColor="#0147b0" />
          <stop offset="1" stopColor="#23bdfe" />
        </linearGradient>
        <filter id="i8-blur" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="28" />
        </filter>
        <path
          id="i8-body"
          d="M598.7 1187.5C516.7 1177.6 451.3 1127.5 427.5 1056.4C407.2 995.8 421 925.7 466.4 857.5C491.7 819.7 514.5 793.3 581.9 724.1C654.5 649.5 679.4 621.4 699.1 591.7C708.3 577.8 719.7 555.3 723.5 543.5C743.3 482 708.6 442 635.3 442C555.3 442 455.9 493.3 396.2 565.5C392.3 570.3 392.4 569.5 397.7 555C416 505.7 444.9 461.7 484.6 422.9C538.3 370.5 607.9 337.9 676.5 333C684.2 332.4 693.4 331.9 697 331.7L703.5 331.5L726.1 286C738.6 261 748.5 240.2 748.1 239.9C747.8 239.6 734.2 234.7 718 229C701.8 223.4 687.4 218.3 686.1 217.8C684 217.1 685.5 215.8 701.6 204.4C728 185.7 763.6 161.3 817 125.3C879.6 83.1 887.3 78 887.8 78.5C888 78.7 889.9 91.4 892 106.7C894.1 122 901.2 172.5 907.9 219C922 318.1 920.8 309 919.9 309C919.5 309 905.7 303.1 889.1 295.9C872.5 288.8 858.5 283.2 858 283.5C856.9 284.2 820.8 355.8 819.6 359.6C819 361.5 820.2 362.6 827.7 367.6C838.7 374.9 858 393.9 864.7 404C888.9 440.3 893.2 481.1 877.9 527.5C872.8 542.9 858.4 572 848 587.9C818.7 632.6 783.2 672.3 717 734.5C711.2 739.9 699.5 751 691 759C682.5 767.1 664.9 783.3 652 795C604.1 838.4 575.1 869.6 556.5 897.5C514.9 960 514.9 1025 556.4 1066.6C599.6 1109.8 673.9 1110.8 737 1069.2C771.9 1046.1 804 1007.9 816.5 974.7C820.6 963.8 819 974.8 813.9 993C790 1077.5 734.3 1147.8 669.6 1175C652.8 1182.1 633.6 1187 622.3 1187C620 1187 617.8 1187.5 617.5 1188C616.7 1189.3 612.4 1189.1 598.7 1187.5Z"
        />
        <path
          id="i8-ribbon"
          d="M616.8 1189.5C615.3 1187.9 618.3 1186 622.4 1186C639.6 1186 669.5 1176 691.3 1163C730.9 1139.5 763.1 1103.6 788.1 1055.5C802.3 1028.3 811 1004 818.2 971.5C819.9 963.8 822.1 953.7 823.2 949C825.9 937.1 826.1 909.2 823.6 896.5C811.9 836.8 771.8 791.9 703.9 762.4C697.9 759.8 693 757.1 693 756.5C693 755.9 696 752.7 699.7 749.4C708.7 741.6 723 728.1 742.5 709.1C764 688.2 765 687.4 765.8 688.6C766.2 689.1 768.8 690.4 771.5 691.4C783 695.7 806.4 707.1 818.5 714.4C880.8 752 919.1 806.2 930.7 873.5C933.4 889.3 933.1 924.5 930.1 941.3C927.4 957 924.1 969.5 919.4 983.1C891.7 1062.8 818.3 1136.9 734.5 1169.8C712.8 1178.3 692.5 1183.7 668 1187.6C657.4 1189.2 617.9 1190.7 616.8 1189.5Z"
        />
        <mask id="i8m-splash-b" maskUnits="userSpaceOnUse" x="211" y="72" width="727" height="1123">
          <path
            className="i8e-m i8e-m--body"
            pathLength="1"
            d="M400 560 C450 455 560 385 680 384 C780 380 815 430 808 485 C800 560 740 630 670 700 C600 770 520 840 480 920 C440 1000 480 1120 600 1145 C700 1165 790 1110 820 1010 C835 960 830 930 826 905"
          />
          <path className="i8e-m i8e-m--arrow" pathLength="1" d="M745 420 L907 38" />
        </mask>
        <mask id="i8m-splash-r" maskUnits="userSpaceOnUse" x="211" y="72" width="727" height="1123">
          <path
            className="i8e-m i8e-m--ribbon"
            pathLength="1"
            d="M612 1182 C740 1176 880 1090 884 930 C888 800 810 728 712 722"
          />
        </mask>
      </defs>
      <g className="i8e-px">
        <rect
          x="563.0"
          y="649.0"
          width="16.0"
          height="16.0"
          fill="#c9f4ff"
          style={{ "--d": "0", "--tx": "-291px", "--ty": "-116px" } as CSSProperties}
        />
        <rect
          x="525.0"
          y="692.0"
          width="21.0"
          height="21.0"
          fill="#c9f4ff"
          style={{ "--d": "1", "--tx": "-427px", "--ty": "-10px" } as CSSProperties}
        />
        <rect
          x="480.0"
          y="585.0"
          width="26.0"
          height="26.0"
          fill="#5fd8f5"
          style={{ "--d": "2", "--tx": "-456px", "--ty": "36px" } as CSSProperties}
        />
        <rect
          x="478.8"
          y="726.2"
          width="30.5"
          height="30.5"
          fill="#5fd8f5"
          style={{ "--d": "3", "--tx": "-142px", "--ty": "193px" } as CSSProperties}
        />
        <rect
          x="475.8"
          y="650.2"
          width="28.5"
          height="28.5"
          fill="#8fe9ff"
          style={{ "--d": "4", "--tx": "-277px", "--ty": "223px" } as CSSProperties}
        />
        <rect
          x="425.5"
          y="762.5"
          width="34.0"
          height="34.0"
          fill="#8fe9ff"
          style={{ "--d": "5", "--tx": "-240px", "--ty": "220px" } as CSSProperties}
        />
        <rect
          x="412.0"
          y="681.0"
          width="41.0"
          height="41.0"
          fill="#8fe9ff"
          style={{ "--d": "6", "--tx": "-158px", "--ty": "-19px" } as CSSProperties}
        />
        <rect
          x="405.0"
          y="864.0"
          width="47.0"
          height="47.0"
          fill="#5fd8f5"
          style={{ "--d": "7", "--tx": "-273px", "--ty": "204px" } as CSSProperties}
        />
        <rect
          x="386.8"
          y="604.2"
          width="45.5"
          height="45.5"
          fill="#12BFEA"
          style={{ "--d": "8", "--tx": "-199px", "--ty": "-104px" } as CSSProperties}
        />
        <rect
          x="377.8"
          y="1099.2"
          width="15.5"
          height="15.5"
          fill="#ffffff"
          style={{ "--d": "9", "--tx": "-190px", "--ty": "172px" } as CSSProperties}
        />
        <rect
          x="368.0"
          y="799.0"
          width="32.0"
          height="32.0"
          fill="#c9f4ff"
          style={{ "--d": "10", "--tx": "-225px", "--ty": "171px" } as CSSProperties}
        />
        <rect
          x="360.2"
          y="1024.8"
          width="28.5"
          height="28.5"
          fill="#ffffff"
          style={{ "--d": "11", "--tx": "-216px", "--ty": "211px" } as CSSProperties}
        />
        <rect
          x="334.0"
          y="713.0"
          width="44.0"
          height="44.0"
          fill="#8fe9ff"
          style={{ "--d": "12", "--tx": "-207px", "--ty": "106px" } as CSSProperties}
        />
        <rect
          x="332.2"
          y="947.8"
          width="43.5"
          height="43.5"
          fill="#12BFEA"
          style={{ "--d": "13", "--tx": "-431px", "--ty": "-109px" } as CSSProperties}
        />
        <rect
          x="332.0"
          y="865.0"
          width="45.0"
          height="45.0"
          fill="#12BFEA"
          style={{ "--d": "14", "--tx": "-187px", "--ty": "-9px" } as CSSProperties}
        />
        <rect
          x="327.5"
          y="644.5"
          width="20.0"
          height="20.0"
          fill="#12BFEA"
          style={{ "--d": "15", "--tx": "-355px", "--ty": "232px" } as CSSProperties}
        />
        <rect
          x="310.0"
          y="1045.0"
          width="21.0"
          height="21.0"
          fill="#8fe9ff"
          style={{ "--d": "16", "--tx": "-330px", "--ty": "-61px" } as CSSProperties}
        />
        <rect
          x="290.0"
          y="786.0"
          width="45.0"
          height="45.0"
          fill="#c9f4ff"
          style={{ "--d": "17", "--tx": "-214px", "--ty": "-220px" } as CSSProperties}
        />
        <rect
          x="286.0"
          y="977.0"
          width="18.0"
          height="18.0"
          fill="#ffffff"
          style={{ "--d": "18", "--tx": "-458px", "--ty": "221px" } as CSSProperties}
        />
        <rect
          x="278.8"
          y="715.2"
          width="19.5"
          height="19.5"
          fill="#5fd8f5"
          style={{ "--d": "19", "--tx": "-361px", "--ty": "217px" } as CSSProperties}
        />
        <rect
          x="259.0"
          y="887.0"
          width="34.0"
          height="34.0"
          fill="#ffffff"
          style={{ "--d": "20", "--tx": "-316px", "--ty": "-162px" } as CSSProperties}
        />
        <rect
          x="217.0"
          y="819.0"
          width="23.0"
          height="23.0"
          fill="#12BFEA"
          style={{ "--d": "21", "--tx": "-404px", "--ty": "16px" } as CSSProperties}
        />
      </g>
      <g className="i8e-glow" filter="url(#i8-blur)">
        <use href="#i8-body" />
        <use href="#i8-ribbon" />
      </g>
      <g mask="url(#i8m-splash-b)">
        <use className="i8e-body" href="#i8-body" fill="url(#i8-gb)" />
      </g>
      <g mask="url(#i8m-splash-r)">
        <use className="i8e-ribbon" href="#i8-ribbon" fill="url(#i8-gr)" />
      </g>
    </svg>
  );
}
