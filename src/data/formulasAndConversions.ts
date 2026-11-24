export interface ChemistryFormulaItem {
  id: string;
  topic: string;
  grade: string;
  title: string;
  equation: string;
  variables: string;
  note: string;
}

export const CHEMISTRY_FORMULAS: ChemistryFormulaItem[] = [
  {
    id: 'f_mol_mass',
    topic: 'Mol & Khối lượng',
    grade: 'Lớp 10–12',
    title: 'Số mol theo khối lượng',
    equation: 'n = m / M  ⇒  m = n · M',
    variables: 'n: số mol (mol); m: khối lượng (g); M: khối lượng mol (g/mol)',
    note: 'Khối lượng mol M có giá trị số bằng phân tử khối (amu).',
  },
  {
    id: 'f_mol_gas_dkc',
    topic: 'Chất khí (CT GDPT 2018)',
    grade: 'Lớp 10–12',
    title: 'Thể tích khí ở điều kiện chuẩn (đkc: 25°C, 1 bar)',
    equation: 'n = V / 24,79  ⇒  V = 24,79 · n',
    variables: 'V: thể tích khí ở 25°C, 1 bar (lít); n: số mol khí (mol)',
    note: 'Sách Kết nối tri thức dùng chuẩn 24,79 L/mol tại 25°C (298,15 K) và 1 bar.',
  },
  {
    id: 'f_ideal_gas',
    topic: 'Chất khí (CT GDPT 2018)',
    grade: 'Lớp 10–12',
    title: 'Phương trình khí lí tưởng (Clapeyron–Mendeleev)',
    equation: 'P · V = n · R · T',
    variables: 'P: áp suất (bar hoặc atm); V: thể tích (L); T = t°C + 273,15 (K); R = 0,08314 L·bar/(mol·K) hoặc 0,082 L·atm/(mol·K)',
    note: 'Dùng khi bài toán cho áp suất và nhiệt độ bất kì khác đkc.',
  },
  {
    id: 'f_mol_particles',
    topic: 'Mol & Khối lượng',
    grade: 'Lớp 10',
    title: 'Số hạt nguyên tử / phân tử',
    equation: 'N = n · N_A  (N_A = 6,022 × 10²³)',
    variables: 'N: số hạt vi mô; n: số mol; N_A: hằng số Avogadro (mol⁻¹)',
    note: '1 mol chất bất kì luôn chứa 6,022 × 10²³ hạt vi mô.',
  },
  {
    id: 'f_cm',
    topic: 'Dung dịch & Nồng độ',
    grade: 'Lớp 10–12',
    title: 'Nồng độ mol dung dịch (C_M)',
    equation: 'C_M = n / V_dd  ⇒  n = C_M · V_dd',
    variables: 'C_M: nồng độ mol (mol/L hay M); n: số mol chất tan (mol); V_dd: thể tích dung dịch (L)',
    note: 'Luôn đổi thể tích từ mL sang L bằng cách chia 1000.',
  },
  {
    id: 'f_cpercent',
    topic: 'Dung dịch & Nồng độ',
    grade: 'Lớp 10–12',
    title: 'Nồng độ phần trăm (C%) & Khối lượng riêng (D)',
    equation: 'C% = (m_ct / m_dd) × 100%   |   m_dd = V_dd · D',
    variables: 'm_ct: khối lượng chất tan (g); m_dd: khối lượng dung dịch (g); D: khối lượng riêng (g/mL)',
    note: 'm_dd sau phản ứng = Σm_chất tham gia − m_kết tủa − m_khí bay ra.',
  },
  {
    id: 'f_cm_cpercent_bridge',
    topic: 'Dung dịch & Nồng độ',
    grade: 'Lớp 10–12',
    title: 'Liên hệ trực tiếp giữa C_M và C%',
    equation: 'C_M = (10 · C% · D) / M',
    variables: 'C_M (mol/L); C% (%); D (g/mL); M: khối lượng mol chất tan (g/mol)',
    note: 'Suy ra từ việc xét 1000 mL dung dịch: m_dd = 1000·D ⇒ m_ct = 10·C%·D ⇒ n = 10·C%·D/M.',
  },
  {
    id: 'f_enthalpy',
    topic: 'Nhiệt hóa học & Tốc độ',
    grade: 'Lớp 10',
    title: 'Biến thiên Enthalpy chuẩn phản ứng (Δ_r H°₂₉₈)',
    equation: 'Δ_r H° = ΣΔ_f H°(sp) − ΣΔ_f H°(cđ) = ΣE_b(cđ) − ΣE_b(sp)',
    variables: 'Δ_f H°: enthalpy tạo thành chuẩn; E_b: năng lượng liên kết (kJ/mol)',
    note: 'Δ_r H° < 0 là phản ứng tỏa nhiệt; Δ_r H° > 0 là phản ứng thu nhiệt.',
  },
  {
    id: 'f_vant_hoff',
    topic: 'Nhiệt hóa học & Tốc độ',
    grade: 'Lớp 10',
    title: 'Hệ số nhiệt độ Van’t Hoff',
    equation: 'v₂ / v₁ = γ^((T₂ − T₁) / 10)',
    variables: 'v₁, v₂: tốc độ tại T₁, T₂; γ: hệ số nhiệt độ (thường từ 2 đến 4)',
    note: 'Tăng nhiệt độ thêm 10°C thì tốc độ phản ứng tăng lên γ lần.',
  },
  {
    id: 'f_ph',
    topic: 'Cân bằng & Điện li',
    grade: 'Lớp 11',
    title: 'Độ pH và tích số ion của nước',
    equation: 'pH = −lg[H⁺]   |   [H⁺] · [OH⁻] = 10⁻¹⁴   |   α = (C_điện li / C_ban đầu) × 100%',
    variables: '[H⁺], [OH⁻]: nồng độ mol ion (M); α: độ điện li (%)',
    note: 'Nếu [H⁺] = 10⁻ᵃ M ⇒ pH = a. Với bazơ mạnh: pOH = −lg[OH⁻], pH = 14 − pOH.',
  },
  {
    id: 'f_pin_dien',
    topic: 'Pin điện & Điện phân',
    grade: 'Lớp 12',
    title: 'Sức điện động chuẩn & Định luật Faraday',
    equation: 'E°_pin = E°_catot − E°_anot   |   m = (A · I · t) / (n · F)',
    variables: 'A: nguyên tử khối; I: cường độ dòng điện (A); t: thời gian (giây); n: số e trao đổi; F = 96485 C/mol',
    note: 'Số mol electron trao đổi ở mỗi điện cực: n_e = (I · t) / 96485.',
  },
  {
    id: 'f_hieu_suat',
    topic: 'Hiệu suất & Hữu cơ',
    grade: 'Lớp 10–12',
    title: 'Hiệu suất phản ứng (H%) & Độ rượu (Độ cồn)',
    equation: 'H% = (m_thực tế / m_lí thuyết) × 100%   |   Độ cồn = (V_C₂H₅OH / V_dd) × 100',
    variables: 'Lưu ý: tính lượng chất tham gia thực tế phải CHIA cho H%, tính lượng sản phẩm thu được phải NHÂN với H%.',
    note: 'Áp dụng cho cả bài toán tổng hợp NH₃, phản ứng ester hóa và lên men rượu.',
  },
];
