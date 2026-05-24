# Hardcoded Tables from San Ming Tong Hui & Zi Ping Zhen Quan

HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"]

HEAVENLY_STEMS_ELEMENT = {
    "甲": "Wood", "乙": "Wood",
    "丙": "Fire", "丁": "Fire",
    "戊": "Earth", "己": "Earth",
    "庚": "Metal", "辛": "Metal",
    "壬": "Water", "癸": "Water",
}

HEAVENLY_STEMS_POLARITY = {
    "甲": "Yang", "乙": "Yin",
    "丙": "Yang", "丁": "Yin",
    "戊": "Yang", "己": "Yin",
    "庚": "Yang", "辛": "Yin",
    "壬": "Yang", "癸": "Yin",
}

EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"]

EARTHLY_BRANCHES_ELEMENT = {
    "子": "Water", "丑": "Earth", "寅": "Wood", "卯": "Wood",
    "辰": "Earth", "巳": "Fire", "午": "Fire", "未": "Earth",
    "申": "Metal", "酉": "Metal", "戌": "Earth", "亥": "Water",
}

HIDDEN_STEMS = {
    "子": ["癸"],
    "丑": ["己", "癸", "辛"],
    "寅": ["甲", "丙", "戊"],
    "卯": ["乙"],
    "辰": ["戊", "乙", "癸"],
    "巳": ["丙", "庚", "戊"],
    "午": ["丁", "己"],
    "未": ["己", "丁", "乙"],
    "申": ["庚", "壬", "戊"],
    "酉": ["辛"],
    "戌": ["戊", "辛", "丁"],
    "亥": ["壬", "甲"],
}

SIX_CLASHES = [
    {"子", "午"}, {"丑", "未"}, {"寅", "申"},
    {"卯", "酉"}, {"辰", "戌"}, {"巳", "亥"},
]

SIX_COMBINATIONS = [
    ({"子", "丑"}, "Earth"),
    ({"寅", "亥"}, "Wood"),
    ({"卯", "戌"}, "Fire"),
    ({"辰", "酉"}, "Metal"),
    ({"巳", "申"}, "Water"),
    ({"午", "未"}, "Fire"),
]

THREE_COMBINATIONS = [
    ({"申", "子", "辰"}, "Water"),
    ({"亥", "卯", "未"}, "Wood"),
    ({"寅", "午", "戌"}, "Fire"),
    ({"巳", "酉", "丑"}, "Metal"),
]

SIX_HARMS = [
    {"子", "未"}, {"丑", "午"}, {"寅", "巳"},
    {"卯", "辰"}, {"申", "亥"}, {"酉", "戌"},
]

THREE_PENALTIES = [
    {"寅", "巳", "申"},  # Ungrateful Penalty
    {"丑", "戌", "未"},  # Bullying Penalty
    {"子", "卯"},         # Uncivilized Penalty
    {"辰"},               # Self Penalty
    {"午"},               # Self Penalty
    {"酉"},               # Self Penalty
    {"亥"},               # Self Penalty
]

HOUR_BRANCHES = {
    (23, 1): "子",
    (1, 3): "丑",
    (3, 5): "寅",
    (5, 7): "卯",
    (7, 9): "辰",
    (9, 11): "巳",
    (11, 13): "午",
    (13, 15): "未",
    (15, 17): "申",
    (17, 19): "酉",
    (19, 21): "戌",
    (21, 23): "亥",
}

PRODUCES = {
    "Wood": "Fire", "Fire": "Earth", "Earth": "Metal",
    "Metal": "Water", "Water": "Wood",
}

CONTROLS = {
    "Wood": "Earth", "Earth": "Water", "Water": "Fire",
    "Fire": "Metal", "Metal": "Wood",
}

# Heavenly Stem Combinations (天干合): pair → result element
STEM_COMBINATIONS = [
    ({"甲", "己"}, "Earth"),
    ({"乙", "庚"}, "Metal"),
    ({"丙", "辛"}, "Water"),
    ({"丁", "壬"}, "Wood"),
    ({"戊", "癸"}, "Fire"),
]

# Kong Wang (空亡): xun start index → [void_branch1, void_branch2]
# Each 旬 starts at 甲 and uses 10 consecutive branches, leaving 2 void
KONG_WANG = {
    0:  ["戌", "亥"],   # 甲子旬
    10: ["申", "酉"],   # 甲戌旬
    20: ["午", "未"],   # 甲申旬
    30: ["辰", "巳"],   # 甲午旬
    40: ["寅", "卯"],   # 甲辰旬
    50: ["子", "丑"],   # 甲寅旬
}
