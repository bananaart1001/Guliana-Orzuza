import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const SALES = ['汪浩浩', '姚总', '崔柏', '程珂', '抖音私信'];

export const CHANNELS = [
  { v: '运营指定', lk: false },
  { v: '抖音私信', lk: false },
  { v: '旧资追回', lk: false },
  { v: '销售截单', lk: false },
  { v: '付费投放', lk: true },
  { v: '蓝V电话来电', lk: true },
  { v: '矩阵引流电话', lk: true },
  { v: '运营截单', lk: true },
];

export const PRIVATE_OPTS = ['已添加', '添加未通过', '对方拒加抖私续聊', '电话中断'] as const;
export const FOLLOW_OPTS = ['新询盘', '跟进中', '已报价', '待联系', '已成交', '无效'] as const;

export type PrivateStatus = (typeof PRIVATE_OPTS)[number];
export type FollowStatus = (typeof FOLLOW_OPTS)[number];

export const PRIVATE_STYLE: Record<PrivateStatus, string> = {
  '已添加': 'text-[#6d8c7d] bg-[#6d8c7d]/10 border-[#6d8c7d]/20',
  '添加未通过': 'text-[#8c857d] bg-[#f7f3f0] border-[#e6e0d9]',
  '对方拒加抖私续聊': 'text-[#b08d00] bg-[#fcf8e3] border-[#f5e79e]',
  '电话中断': 'text-[#bc4c00] bg-[#fff5eb] border-[#ffd8b1]',
};

export const FOLLOW_STYLE: Record<FollowStatus, string> = {
  '新询盘': 'text-blue-600 bg-blue-50 border-blue-100',
  '跟进中': 'text-[#b08d00] bg-[#fcf8e3] border-[#f5e79e]',
  '已报价': 'text-[#6d40c9] bg-[#f5f0ff] border-[#e0d4ff]',
  '待联系': 'text-[#cf222e] bg-[#fff5f5] border-[#ffd1d1]',
  '已成交': 'text-[#4a5d4e] bg-[#a3b18a]/30 border-[#4a5d4e]/10',
  '无效': 'text-[#a09c98] bg-[#f7f3f0] border-[#e6e0d9]',
};

export interface NeedsNode {
  key: string;
  label: string;
  children?: NeedsNode[];
}

export const NEEDS_TREE: NeedsNode[] = [
  { key: 'pvc', label: 'PVC收缩膜标签', children: [{ key: 'pvc_hand', label: '手工单张捆扎' }, { key: 'pvc_machine', label: '机器套标卷材' }] },
  { key: 'pet_shrink', label: 'PET收缩膜标签', children: [{ key: 'pet_s_hand', label: '手工单张捆扎' }, { key: 'pet_s_machine', label: '机器套标卷材' }] },
  { key: 'pet_bright', label: 'PET亮白膜', children: [{ key: 'pet_b_hand', label: '手工单张捆扎' }, { key: 'pet_b_machine', label: '机器套标卷材' }] },
  { key: 'hotmelt_daily', label: '（日化）热熔胶标签', children: [{ key: 'hm_d_hand', label: '手工贴标' }, { key: 'hm_d_left', label: '机器左出卷材' }, { key: 'hm_d_right', label: '机器右出卷材' }] },
  { key: 'hotmelt_drink', label: '（饮品）热熔胶标签', children: [{ key: 'hm_k_hand', label: '手工贴标' }, { key: 'hm_k_left', label: '机器左出卷材' }, { key: 'hm_k_right', label: '机器右出卷材' }] },
  { key: 'hotmelt_other', label: '（其它）热熔胶标签', children: [{ key: 'hm_o_hand', label: '手工贴标' }, { key: 'hm_o_left', label: '机器左出卷材' }, { key: 'hm_o_right', label: '机器右出卷材' }] },
  { key: 'barrel_shrink', label: '桶装水热缩封口', children: [{ key: 'bs_flat', label: '平口双通' }, { key: 'bs_arc', label: '弧形全封' }, { key: 'bs_full', label: '全封闭杯膜' }] },
  { key: 'barrel_body', label: '桶装水桶身不干胶', children: [{ key: 'bb_hand', label: '手工贴标' }, { key: 'bb_machine', label: '机器贴标卷材' }] },
  { key: 'adhesive_other', label: '（其它）不干胶标签', children: [{ key: 'ao_hand', label: '手工贴标' }, { key: 'ao_machine', label: '机器贴标卷材' }] },
  { key: 'barrel_dust', label: '桶装水防尘袋', children: [{ key: 'bd_plain', label: '纯色' }, { key: 'bd_print', label: '印刷定制' }] },
  { key: 'plastic_bag', label: '塑料袋', children: [{ key: 'pb_stock', label: '通货' }, { key: 'pb_print', label: '印刷定制' }] },
  { key: 'composite_roll', label: '复合袋卷材' },
  { key: 'composite_bag', label: '复合袋成袋' },
  { key: 'other', label: '其它' },
];

export interface InquiryRecord {
  id: string;
  sales: string;
  channel: string;
  tiktok: string;
  contact: string;
  region: string;
  inquiry: string;
  needs: string[];
  privateStatus: PrivateStatus;
  followStatus: FollowStatus;
  dealAmount: string;
  updatedAt: number;
}

export const PROVINCES = [
  '广东', '山东', '江苏', '河南', '四川', '河北', '湖北', '湖南', '浙江', '安徽', 
  '江西', '陕西', '辽宁', '福建', '云南', '黑龙江', '山西', '贵州', '广西', '重庆', 
  '广东', '甘肃', '吉林', '内蒙古', '天津', '上海', '新疆', '北京', '宁夏', '海南', 
  '青海', '西藏'
];
