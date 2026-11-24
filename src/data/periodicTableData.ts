export type ElementCategory =
  | 'Phi kim'
  | 'Khí hiếm'
  | 'Kim loại kiềm'
  | 'Kim loại kiềm thổ'
  | 'Á kim'
  | 'Halogen'
  | 'Kim loại sau chuyển tiếp'
  | 'Kim loại chuyển tiếp'
  | 'Lanthanide'
  | 'Actinide';

export interface PeriodicElement {
  number: number;
  symbol: string;
  name: string;
  mass: number;
  xpos: number;
  ypos: number;
  category: ElementCategory;
  shells: number[];
  config: string;
  electronegativity: number | null;
  oxidationStates: string;
  state25C: 'Rắn' | 'Lỏng' | 'Khí';
  radiusPm: number | null;
}

type RawTuple = [
  number, string, string, number, number, number, ElementCategory, number[], string, number | null, string, 'Rắn' | 'Lỏng' | 'Khí', number | null
];

const RAW_ELEMENTS: RawTuple[] = [
  [1,'H','Hydrogen',1.008,1,1,'Phi kim',[1],'1s¹',2.20,'-1, +1','Khí',53],
  [2,'He','Helium',4.0026,18,1,'Khí hiếm',[2],'1s²',null,'0','Khí',31],
  [3,'Li','Lithium',6.94,1,2,'Kim loại kiềm',[2,1],'[He] 2s¹',0.98,'+1','Rắn',167],
  [4,'Be','Beryllium',9.0122,2,2,'Kim loại kiềm thổ',[2,2],'[He] 2s²',1.57,'+2','Rắn',112],
  [5,'B','Boron',10.81,13,2,'Á kim',[2,3],'[He] 2s²2p¹',2.04,'+3','Rắn',87],
  [6,'C','Carbon',12.011,14,2,'Phi kim',[2,4],'[He] 2s²2p²',2.55,'-4, +2, +4','Rắn',67],
  [7,'N','Nitrogen',14.007,15,2,'Phi kim',[2,5],'[He] 2s²2p³',3.04,'-3, +1..+5','Khí',56],
  [8,'O','Oxygen',15.999,16,2,'Phi kim',[2,6],'[He] 2s²2p⁴',3.44,'-2, -1','Khí',48],
  [9,'F','Fluorine',18.998,17,2,'Halogen',[2,7],'[He] 2s²2p⁵',3.98,'-1','Khí',42],
  [10,'Ne','Neon',20.18,18,2,'Khí hiếm',[2,8],'[He] 2s²2p⁶',null,'0','Khí',38],
  [11,'Na','Sodium',22.99,1,3,'Kim loại kiềm',[2,8,1],'[Ne] 3s¹',0.93,'+1','Rắn',190],
  [12,'Mg','Magnesium',24.305,2,3,'Kim loại kiềm thổ',[2,8,2],'[Ne] 3s²',1.31,'+2','Rắn',145],
  [13,'Al','Aluminium',26.982,13,3,'Kim loại sau chuyển tiếp',[2,8,3],'[Ne] 3s²3p¹',1.61,'+3','Rắn',118],
  [14,'Si','Silicon',28.085,14,3,'Á kim',[2,8,4],'[Ne] 3s²3p²',1.90,'-4, +4','Rắn',111],
  [15,'P','Phosphorus',30.974,15,3,'Phi kim',[2,8,5],'[Ne] 3s²3p³',2.19,'-3, +3, +5','Rắn',98],
  [16,'S','Sulfur',32.06,16,3,'Phi kim',[2,8,6],'[Ne] 3s²3p⁴',2.58,'-2, +4, +6','Rắn',88],
  [17,'Cl','Chlorine',35.45,17,3,'Halogen',[2,8,7],'[Ne] 3s²3p⁵',3.16,'-1, +1..+7','Khí',79],
  [18,'Ar','Argon',39.948,18,3,'Khí hiếm',[2,8,8],'[Ne] 3s²3p⁶',null,'0','Khí',71],
  [19,'K','Potassium',39.098,1,4,'Kim loại kiềm',[2,8,8,1],'[Ar] 4s¹',0.82,'+1','Rắn',243],
  [20,'Ca','Calcium',40.078,2,4,'Kim loại kiềm thổ',[2,8,8,2],'[Ar] 4s²',1.00,'+2','Rắn',194],
  [21,'Sc','Scandium',44.956,3,4,'Kim loại chuyển tiếp',[2,8,9,2],'[Ar] 3d¹4s²',1.36,'+3','Rắn',184],
  [22,'Ti','Titanium',47.867,4,4,'Kim loại chuyển tiếp',[2,8,10,2],'[Ar] 3d²4s²',1.54,'+2, +3, +4','Rắn',176],
  [23,'V','Vanadium',50.942,5,4,'Kim loại chuyển tiếp',[2,8,11,2],'[Ar] 3d³4s²',1.63,'+2..+5','Rắn',171],
  [24,'Cr','Chromium',51.996,6,4,'Kim loại chuyển tiếp',[2,8,13,1],'[Ar] 3d⁵4s¹',1.66,'+2, +3, +6','Rắn',166],
  [25,'Mn','Manganese',54.938,7,4,'Kim loại chuyển tiếp',[2,8,13,2],'[Ar] 3d⁵4s²',1.55,'+2, +4, +7','Rắn',161],
  [26,'Fe','Iron',55.845,8,4,'Kim loại chuyển tiếp',[2,8,14,2],'[Ar] 3d⁶4s²',1.83,'+2, +3','Rắn',156],
  [27,'Co','Cobalt',58.933,9,4,'Kim loại chuyển tiếp',[2,8,15,2],'[Ar] 3d⁷4s²',1.88,'+2, +3','Rắn',152],
  [28,'Ni','Nickel',58.693,10,4,'Kim loại chuyển tiếp',[2,8,16,2],'[Ar] 3d⁸4s²',1.91,'+2','Rắn',149],
  [29,'Cu','Copper',63.546,11,4,'Kim loại chuyển tiếp',[2,8,18,1],'[Ar] 3d¹⁰4s¹',1.90,'+1, +2','Rắn',145],
  [30,'Zn','Zinc',65.38,12,4,'Kim loại chuyển tiếp',[2,8,18,2],'[Ar] 3d¹⁰4s²',1.65,'+2','Rắn',142],
  [31,'Ga','Gallium',69.723,13,4,'Kim loại sau chuyển tiếp',[2,8,18,3],'[Ar] 3d¹⁰4s²4p¹',1.81,'+3','Rắn',136],
  [32,'Ge','Germanium',72.63,14,4,'Á kim',[2,8,18,4],'[Ar] 3d¹⁰4s²4p²',2.01,'+2, +4','Rắn',125],
  [33,'As','Arsenic',74.922,15,4,'Á kim',[2,8,18,5],'[Ar] 3d¹⁰4s²4p³',2.18,'-3, +3, +5','Rắn',114],
  [34,'Se','Selenium',78.971,16,4,'Phi kim',[2,8,18,6],'[Ar] 3d¹⁰4s²4p⁴',2.55,'-2, +4, +6','Rắn',103],
  [35,'Br','Bromine',79.904,17,4,'Halogen',[2,8,18,7],'[Ar] 3d¹⁰4s²4p⁵',2.96,'-1, +1, +5','Lỏng',94],
  [36,'Kr','Krypton',83.798,18,4,'Khí hiếm',[2,8,18,8],'[Ar] 3d¹⁰4s²4p⁶',3.00,'0, +2','Khí',88],
  [37,'Rb','Rubidium',85.468,1,5,'Kim loại kiềm',[2,8,18,8,1],'[Kr] 5s¹',0.82,'+1','Rắn',265],
  [38,'Sr','Strontium',87.62,2,5,'Kim loại kiềm thổ',[2,8,18,8,2],'[Kr] 5s²',0.95,'+2','Rắn',219],
  [39,'Y','Yttrium',88.906,3,5,'Kim loại chuyển tiếp',[2,8,18,9,2],'[Kr] 4d¹5s²',1.22,'+3','Rắn',212],
  [40,'Zr','Zirconium',91.224,4,5,'Kim loại chuyển tiếp',[2,8,18,10,2],'[Kr] 4d²5s²',1.33,'+4','Rắn',206],
  [41,'Nb','Niobium',92.906,5,5,'Kim loại chuyển tiếp',[2,8,18,12,1],'[Kr] 4d⁴5s¹',1.60,'+5','Rắn',198],
  [42,'Mo','Molybdenum',95.95,6,5,'Kim loại chuyển tiếp',[2,8,18,13,1],'[Kr] 4d⁵5s¹',2.16,'+4, +6','Rắn',190],
  [43,'Tc','Technetium',98,7,5,'Kim loại chuyển tiếp',[2,8,18,13,2],'[Kr] 4d⁵5s²',1.90,'+4, +7','Rắn',183],
  [44,'Ru','Ruthenium',101.07,8,5,'Kim loại chuyển tiếp',[2,8,18,15,1],'[Kr] 4d⁷5s¹',2.20,'+3, +4, +8','Rắn',178],
  [45,'Rh','Rhodium',102.91,9,5,'Kim loại chuyển tiếp',[2,8,18,16,1],'[Kr] 4d⁸5s¹',2.28,'+3','Rắn',173],
  [46,'Pd','Palladium',106.42,10,5,'Kim loại chuyển tiếp',[2,8,18,18],'[Kr] 4d¹⁰',2.20,'+2, +4','Rắn',169],
  [47,'Ag','Silver',107.87,11,5,'Kim loại chuyển tiếp',[2,8,18,18,1],'[Kr] 4d¹⁰5s¹',1.93,'+1','Rắn',165],
  [48,'Cd','Cadmium',112.41,12,5,'Kim loại chuyển tiếp',[2,8,18,18,2],'[Kr] 4d¹⁰5s²',1.69,'+2','Rắn',161],
  [49,'In','Indium',114.82,13,5,'Kim loại sau chuyển tiếp',[2,8,18,18,3],'[Kr] 4d¹⁰5s²5p¹',1.78,'+3','Rắn',156],
  [50,'Sn','Tin',118.71,14,5,'Kim loại sau chuyển tiếp',[2,8,18,18,4],'[Kr] 4d¹⁰5s²5p²',1.96,'+2, +4','Rắn',145],
  [51,'Sb','Antimony',121.76,15,5,'Á kim',[2,8,18,18,5],'[Kr] 4d¹⁰5s²5p³',2.05,'-3, +3, +5','Rắn',133],
  [52,'Te','Tellurium',127.6,16,5,'Á kim',[2,8,18,18,6],'[Kr] 4d¹⁰5s²5p⁴',2.10,'-2, +4, +6','Rắn',123],
  [53,'I','Iodine',126.9,17,5,'Halogen',[2,8,18,18,7],'[Kr] 4d¹⁰5s²5p⁵',2.66,'-1, +1, +5, +7','Rắn',115],
  [54,'Xe','Xenon',131.29,18,5,'Khí hiếm',[2,8,18,18,8],'[Kr] 4d¹⁰5s²5p⁶',2.60,'0, +2, +4','Khí',108],
  [55,'Cs','Caesium',132.91,1,6,'Kim loại kiềm',[2,8,18,18,8,1],'[Xe] 6s¹',0.79,'+1','Rắn',298],
  [56,'Ba','Barium',137.33,2,6,'Kim loại kiềm thổ',[2,8,18,18,8,2],'[Xe] 6s²',0.89,'+2','Rắn',253],
  [57,'La','Lanthanum',138.91,3,9,'Lanthanide',[2,8,18,18,9,2],'[Xe] 5d¹6s²',1.10,'+3','Rắn',195],
  [58,'Ce','Cerium',140.12,4,9,'Lanthanide',[2,8,18,19,9,2],'[Xe] 4f¹5d¹6s²',1.12,'+3, +4','Rắn',185],
  [59,'Pr','Praseodymium',140.91,5,9,'Lanthanide',[2,8,18,21,8,2],'[Xe] 4f³6s²',1.13,'+3','Rắn',247],
  [60,'Nd','Neodymium',144.24,6,9,'Lanthanide',[2,8,18,22,8,2],'[Xe] 4f⁴6s²',1.14,'+3','Rắn',206],
  [61,'Pm','Promethium',145,7,9,'Lanthanide',[2,8,18,23,8,2],'[Xe] 4f⁵6s²',1.13,'+3','Rắn',205],
  [62,'Sm','Samarium',150.36,8,9,'Lanthanide',[2,8,18,24,8,2],'[Xe] 4f⁶6s²',1.17,'+2, +3','Rắn',238],
  [63,'Eu','Europium',151.96,9,9,'Lanthanide',[2,8,18,25,8,2],'[Xe] 4f⁷6s²',1.20,'+2, +3','Rắn',231],
  [64,'Gd','Gadolinium',157.25,10,9,'Lanthanide',[2,8,18,25,9,2],'[Xe] 4f⁷5d¹6s²',1.20,'+3','Rắn',233],
  [65,'Tb','Terbium',158.93,11,9,'Lanthanide',[2,8,18,27,8,2],'[Xe] 4f⁹6s²',1.20,'+3','Rắn',225],
  [66,'Dy','Dysprosium',162.5,12,9,'Lanthanide',[2,8,18,28,8,2],'[Xe] 4f¹⁰6s²',1.22,'+3','Rắn',228],
  [67,'Ho','Holmium',164.93,13,9,'Lanthanide',[2,8,18,29,8,2],'[Xe] 4f¹¹6s²',1.23,'+3','Rắn',226],
  [68,'Er','Erbium',167.26,14,9,'Lanthanide',[2,8,18,30,8,2],'[Xe] 4f¹²6s²',1.24,'+3','Rắn',226],
  [69,'Tm','Thulium',168.93,15,9,'Lanthanide',[2,8,18,31,8,2],'[Xe] 4f¹³6s²',1.25,'+3','Rắn',222],
  [70,'Yb','Ytterbium',173.05,16,9,'Lanthanide',[2,8,18,32,8,2],'[Xe] 4f¹⁴6s²',1.10,'+2, +3','Rắn',222],
  [71,'Lu','Lutetium',174.97,17,9,'Lanthanide',[2,8,18,32,9,2],'[Xe] 4f¹⁴5d¹6s²',1.27,'+3','Rắn',217],
  [72,'Hf','Hafnium',178.49,4,6,'Kim loại chuyển tiếp',[2,8,18,32,10,2],'[Xe] 4f¹⁴5d²6s²',1.30,'+4','Rắn',208],
  [73,'Ta','Tantalum',180.95,5,6,'Kim loại chuyển tiếp',[2,8,18,32,11,2],'[Xe] 4f¹⁴5d³6s²',1.50,'+5','Rắn',200],
  [74,'W','Tungsten',183.84,6,6,'Kim loại chuyển tiếp',[2,8,18,32,12,2],'[Xe] 4f¹⁴5d⁴6s²',2.36,'+4, +6','Rắn',193],
  [75,'Re','Rhenium',186.21,7,6,'Kim loại chuyển tiếp',[2,8,18,32,13,2],'[Xe] 4f¹⁴5d⁵6s²',1.90,'+4, +7','Rắn',188],
  [76,'Os','Osmium',190.23,8,6,'Kim loại chuyển tiếp',[2,8,18,32,14,2],'[Xe] 4f¹⁴5d⁶6s²',2.20,'+4, +8','Rắn',185],
  [77,'Ir','Iridium',192.22,9,6,'Kim loại chuyển tiếp',[2,8,18,32,15,2],'[Xe] 4f¹⁴5d⁷6s²',2.20,'+3, +4','Rắn',180],
  [78,'Pt','Platinum',195.08,10,6,'Kim loại chuyển tiếp',[2,8,18,32,17,1],'[Xe] 4f¹⁴5d⁹6s¹',2.28,'+2, +4','Rắn',177],
  [79,'Au','Gold',196.97,11,6,'Kim loại chuyển tiếp',[2,8,18,32,18,1],'[Xe] 4f¹⁴5d¹⁰6s¹',2.54,'+1, +3','Rắn',174],
  [80,'Hg','Mercury',200.59,12,6,'Kim loại chuyển tiếp',[2,8,18,32,18,2],'[Xe] 4f¹⁴5d¹⁰6s²',2.00,'+1, +2','Lỏng',171],
  [81,'Tl','Thallium',204.38,13,6,'Kim loại sau chuyển tiếp',[2,8,18,32,18,3],'[Xe] 4f¹⁴5d¹⁰6s²6p¹',1.62,'+1, +3','Rắn',156],
  [82,'Pb','Lead',207.2,14,6,'Kim loại sau chuyển tiếp',[2,8,18,32,18,4],'[Xe] 4f¹⁴5d¹⁰6s²6p²',2.33,'+2, +4','Rắn',154],
  [83,'Bi','Bismuth',208.98,15,6,'Kim loại sau chuyển tiếp',[2,8,18,32,18,5],'[Xe] 4f¹⁴5d¹⁰6s²6p³',2.02,'+3, +5','Rắn',143],
  [84,'Po','Polonium',209,16,6,'Kim loại sau chuyển tiếp',[2,8,18,32,18,6],'[Xe] 4f¹⁴5d¹⁰6s²6p⁴',2.00,'+2, +4','Rắn',135],
  [85,'At','Astatine',210,17,6,'Halogen',[2,8,18,32,18,7],'[Xe] 4f¹⁴5d¹⁰6s²6p⁵',2.20,'-1, +1','Rắn',127],
  [86,'Rn','Radon',222,18,6,'Khí hiếm',[2,8,18,32,18,8],'[Xe] 4f¹⁴5d¹⁰6s²6p⁶',2.20,'0, +2','Khí',120],
  [87,'Fr','Francium',223,1,7,'Kim loại kiềm',[2,8,18,32,18,8,1],'[Rn] 7s¹',0.70,'+1','Rắn',null],
  [88,'Ra','Radium',226,2,7,'Kim loại kiềm thổ',[2,8,18,32,18,8,2],'[Rn] 7s²',0.90,'+2','Rắn',null],
  [89,'Ac','Actinium',227,3,10,'Actinide',[2,8,18,32,18,9,2],'[Rn] 6d¹7s²',1.10,'+3','Rắn',null],
  [90,'Th','Thorium',232.04,4,10,'Actinide',[2,8,18,32,18,10,2],'[Rn] 6d²7s²',1.30,'+4','Rắn',null],
  [91,'Pa','Protactinium',231.04,5,10,'Actinide',[2,8,18,32,20,9,2],'[Rn] 5f²6d¹7s²',1.50,'+5','Rắn',null],
  [92,'U','Uranium',238.03,6,10,'Actinide',[2,8,18,32,21,9,2],'[Rn] 5f³6d¹7s²',1.38,'+4, +6','Rắn',null],
  [93,'Np','Neptunium',237,7,10,'Actinide',[2,8,18,32,22,9,2],'[Rn] 5f⁴6d¹7s²',1.36,'+3..+6','Rắn',null],
  [94,'Pu','Plutonium',244,8,10,'Actinide',[2,8,18,32,24,8,2],'[Rn] 5f⁶7s²',1.28,'+3..+6','Rắn',null],
  [95,'Am','Americium',243,9,10,'Actinide',[2,8,18,32,25,8,2],'[Rn] 5f⁷7s²',1.30,'+3','Rắn',null],
  [96,'Cm','Curium',247,10,10,'Actinide',[2,8,18,32,25,9,2],'[Rn] 5f⁷6d¹7s²',1.30,'+3','Rắn',null],
  [97,'Bk','Berkelium',247,11,10,'Actinide',[2,8,18,32,27,8,2],'[Rn] 5f⁹7s²',1.30,'+3, +4','Rắn',null],
  [98,'Cf','Californium',251,12,10,'Actinide',[2,8,18,32,28,8,2],'[Rn] 5f¹⁰7s²',1.30,'+3','Rắn',null],
  [99,'Es','Einsteinium',252,13,10,'Actinide',[2,8,18,32,29,8,2],'[Rn] 5f¹¹7s²',1.30,'+3','Rắn',null],
  [100,'Fm','Fermium',257,14,10,'Actinide',[2,8,18,32,30,8,2],'[Rn] 5f¹²7s²',1.30,'+3','Rắn',null],
  [101,'Md','Mendelevium',258,15,10,'Actinide',[2,8,18,32,31,8,2],'[Rn] 5f¹³7s²',1.30,'+2, +3','Rắn',null],
  [102,'No','Nobelium',259,16,10,'Actinide',[2,8,18,32,32,8,2],'[Rn] 5f¹⁴7s²',1.30,'+2, +3','Rắn',null],
  [103,'Lr','Lawrencium',266,17,10,'Actinide',[2,8,18,32,32,8,3],'[Rn] 5f¹⁴7s²7p¹',1.30,'+3','Rắn',null],
  [104,'Rf','Rutherfordium',267,4,7,'Kim loại chuyển tiếp',[2,8,18,32,32,10,2],'[Rn] 5f¹⁴6d²7s²',null,'+4','Rắn',null],
  [105,'Db','Dubnium',268,5,7,'Kim loại chuyển tiếp',[2,8,18,32,32,11,2],'[Rn] 5f¹⁴6d³7s²',null,'+5','Rắn',null],
  [106,'Sg','Seaborgium',269,6,7,'Kim loại chuyển tiếp',[2,8,18,32,32,12,2],'[Rn] 5f¹⁴6d⁴7s²',null,'+6','Rắn',null],
  [107,'Bh','Bohrium',270,7,7,'Kim loại chuyển tiếp',[2,8,18,32,32,13,2],'[Rn] 5f¹⁴6d⁵7s²',null,'+7','Rắn',null],
  [108,'Hs','Hassium',277,8,7,'Kim loại chuyển tiếp',[2,8,18,32,32,14,2],'[Rn] 5f¹⁴6d⁶7s²',null,'+8','Rắn',null],
  [109,'Mt','Meitnerium',278,9,7,'Kim loại chuyển tiếp',[2,8,18,32,32,15,2],'[Rn] 5f¹⁴6d⁷7s²',null,'+3','Rắn',null],
  [110,'Ds','Darmstadtium',281,10,7,'Kim loại chuyển tiếp',[2,8,18,32,32,17,1],'[Rn] 5f¹⁴6d⁹7s¹',null,'+2','Rắn',null],
  [111,'Rg','Roentgenium',282,11,7,'Kim loại chuyển tiếp',[2,8,18,32,32,18,1],'[Rn] 5f¹⁴6d¹⁰7s¹',null,'+1, +3','Rắn',null],
  [112,'Cn','Copernicium',285,12,7,'Kim loại chuyển tiếp',[2,8,18,32,32,18,2],'[Rn] 5f¹⁴6d¹⁰7s²',null,'+2','Rắn',null],
  [113,'Nh','Nihonium',286,13,7,'Kim loại sau chuyển tiếp',[2,8,18,32,32,18,3],'[Rn] 5f¹⁴6d¹⁰7s²7p¹',null,'+1','Rắn',null],
  [114,'Fl','Flerovium',289,14,7,'Kim loại sau chuyển tiếp',[2,8,18,32,32,18,4],'[Rn] 5f¹⁴6d¹⁰7s²7p²',null,'+2','Rắn',null],
  [115,'Mc','Moscovium',290,15,7,'Kim loại sau chuyển tiếp',[2,8,18,32,32,18,5],'[Rn] 5f¹⁴6d¹⁰7s²7p³',null,'+1, +3','Rắn',null],
  [116,'Lv','Livermorium',293,16,7,'Kim loại sau chuyển tiếp',[2,8,18,32,32,18,6],'[Rn] 5f¹⁴6d¹⁰7s²7p⁴',null,'+2','Rắn',null],
  [117,'Ts','Tennessine',294,17,7,'Halogen',[2,8,18,32,32,18,7],'[Rn] 5f¹⁴6d¹⁰7s²7p⁵',null,'-1, +1','Rắn',null],
  [118,'Og','Oganesson',294,18,7,'Khí hiếm',[2,8,18,32,32,18,8],'[Rn] 5f¹⁴6d¹⁰7s²7p⁶',null,'0','Rắn',null],
];

export const PERIODIC_ELEMENTS: PeriodicElement[] = RAW_ELEMENTS.map((t) => ({
  number: t[0],
  symbol: t[1],
  name: t[2],
  mass: t[3],
  xpos: t[4],
  ypos: t[5],
  category: t[6],
  shells: t[7],
  config: t[8],
  electronegativity: t[9],
  oxidationStates: t[10],
  state25C: t[11],
  radiusPm: t[12],
}));

export const CATEGORY_STYLES: Record<ElementCategory, { bg: string; border: string; text: string }> = {
  'Phi kim': { bg: 'bg-sky-950/75', border: 'border-sky-500/45', text: 'text-sky-100' },
  'Khí hiếm': { bg: 'bg-violet-950/75', border: 'border-violet-500/45', text: 'text-violet-100' },
  'Kim loại kiềm': { bg: 'bg-rose-950/75', border: 'border-rose-500/45', text: 'text-rose-100' },
  'Kim loại kiềm thổ': { bg: 'bg-amber-950/75', border: 'border-amber-500/45', text: 'text-amber-100' },
  'Á kim': { bg: 'bg-teal-950/75', border: 'border-teal-500/45', text: 'text-teal-100' },
  'Halogen': { bg: 'bg-emerald-950/75', border: 'border-emerald-500/45', text: 'text-emerald-100' },
  'Kim loại sau chuyển tiếp': { bg: 'bg-slate-800/80', border: 'border-slate-500/45', text: 'text-slate-100' },
  'Kim loại chuyển tiếp': { bg: 'bg-orange-950/70', border: 'border-orange-500/45', text: 'text-orange-100' },
  'Lanthanide': { bg: 'bg-indigo-950/75', border: 'border-indigo-500/45', text: 'text-indigo-100' },
  'Actinide': { bg: 'bg-fuchsia-950/75', border: 'border-fuchsia-500/45', text: 'text-fuchsia-100' },
};
