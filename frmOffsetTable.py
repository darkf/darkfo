import sys, math, struct, os
from construct import *

DATA_PATH = "data"
MAX_FRAMES = 6

class Frames(Construct):
    def _parse(self, stream, context):
    	allFrames = []
    	for i in range(MAX_FRAMES):
    		frames = Pointer(lambda _: 0x3e + context.offset[i],
    			Array(lambda _: context.framesPerDirection,
    				Struct("",
	    				UBInt16("width"),
	    				UBInt16("height"),
	    				UBInt32("s"),
	    				SBInt16("_xoff"),
	    				SBInt16("_yoff")
	    			)
    			)
    		)._parse(stream, context)

    		for i,frame in enumerate(frames):
    			if frame.s != frame.width * frame.height:
    				raise Exception("sanity check error: index %d: width=%d, height=%d, s=%d" % (i, frame.width, frame.height, frame.s))

    		xoff_total = sum(frame._xoff for frame in frames)
    		yoff_total = sum(frame._yoff for frame in frames)

    		#print "xoff:", xoff_total, "yoff:", yoff_total
    		allFrames.append(frames)
    	return allFrames


    def _build(self, obj, stream, context):
        # write obj to the stream (usually not directly)
        # no return value is necessary
        raise NotImpl()

    def _sizeof(self, context):
        # return computed size, or raise SizeofError if not possible
        raise SizeofError()

frm = Struct("frm",
	UBInt32("version"),

	SBInt16("fps"),
	SBInt16("actionFrame"),
	UBInt16("framesPerDirection"),

	Array(MAX_FRAMES, SBInt16("shiftX")),
	Array(MAX_FRAMES, SBInt16("shiftY")),
	Array(MAX_FRAMES, SBInt32("offset")),

	#Frames("frames")
)

"""
	for (size_t i = 0; i < m_offsets.size(); ++i) {
			unsigned int pos = 0x3e + m_offsets[i];
			m_data->setIndex(pos);
			int16_t xoff_total = 0;
			int16_t yoff_total = 0;
			for (uint16_t k = 0; k < m_frames_per_direction; ++k) {

				FrameInfo fi;
				fi.width  = m_data->read16Big();
				fi.height = m_data->read16Big();
				uint32_t s = m_data->read32Big();
				if (s != static_cast<uint32_t>(fi.width * fi.height)) {
					// FIXME cleanup?
					throw InvalidFormat("Frame size mismatch in file " + m_file);
				}
				xoff_total += m_data->read16Big();
				fi.xoff = xoff_total;
				yoff_total += m_data->read16Big();
				fi.yoff = yoff_total;
				fi.fpos = m_data->getCurrentIndex();
				fi.image = 0;

				m_data->moveIndex(s);
				m_frame_info[i].push_back(fi);
			}
		}
"""

def main():
	if len(sys.argv) != 2:
		print "USAGE: %s <frm_list.txt>" % sys.argv[0]
		return

	FRM_LIST = sys.argv[1]
	files = [x.rstrip() for x in open(FRM_LIST, "r")]
	frms = [x+".frm" for x in files]

	print "{"

	for i,frmFile in enumerate(frms):
		with open(os.path.join(DATA_PATH, frmFile), "rb") as f:
			data = f.read()
			frm_ = frm.parse(data)

			terminator = "," if i != len(frms)-1 else ""
			print '    "%s": {"x": %d, "y": %d}%s' % (files[i], frm_.shiftX[0], frm_.shiftY[0], terminator)

	print "}"

if __name__ == '__main__':
	main()


"""
void FRM::load() {
		m_data = VFS::instance()->open(m_file);

		m_data->setIndex(0);
		m_version = m_data->read32Big();

		m_frames_per_second = m_data->read16Big();
		m_action_frame_idx = m_data->read16Big();

		m_frames_per_direction = m_data->read16Big();

		// safeguard against div-by-zero; maybe it should generally be +1?
		if (m_frames_per_second == 0) {
			m_frames_per_second = 50; //m_frames_per_direction / 2;
		}

		for (size_t i = 0; i < m_shifts_x.size(); ++i) {
			m_shifts_x[i] = m_data->read16Big();
		}

		for (size_t i = 0; i < m_shifts_y.size(); ++i) {
			m_shifts_y[i] = m_data->read16Big();
		}

		for (size_t i = 0; i < m_offsets.size(); ++i) {
			m_offsets[i] = m_data->read32Big();
		}

		// not sure if mess up with the indices
		for (size_t i = 0; i < m_offsets.size(); ++i) {
			unsigned int pos = 0x3e + m_offsets[i];
			m_data->setIndex(pos);
			int16_t xoff_total = 0;
			int16_t yoff_total = 0;
			for (uint16_t k = 0; k < m_frames_per_direction; ++k) {

				FrameInfo fi;
				fi.width  = m_data->read16Big();
				fi.height = m_data->read16Big();
				uint32_t s = m_data->read32Big();
				if (s != static_cast<uint32_t>(fi.width * fi.height)) {
					// FIXME cleanup?
					throw InvalidFormat("Frame size mismatch in file " + m_file);
				}
				xoff_total += m_data->read16Big();
				fi.xoff = xoff_total;
				yoff_total += m_data->read16Big();
				fi.yoff = yoff_total;
				fi.fpos = m_data->getCurrentIndex();
				fi.image = 0;

				m_data->moveIndex(s);
				m_frame_info[i].push_back(fi);
			}
		}

		// adds the offset ref fix (formerly in loadFrames()):
		m_directions = 0;
		for (size_t i = 0; i < m_offsets.size(); ++i) {
			uint32_t offset =  m_offsets[i];
			size_t ref_i = i;
			for(size_t j =0; j<i; ++j) {
				if(offset == m_offsets[j]) {
					ref_i = j;
				}
			}
			for (size_t k = 0; k < m_frames_per_direction; ++k) {
				if (ref_i < i) {
					m_frame_info[i][k].fpos = m_frame_info[ref_i][k].fpos;
					m_frame_info[i][k].xoff = m_frame_info[ref_i][k].xoff;
					m_frame_info[i][k].yoff = m_frame_info[ref_i][k].yoff;
					m_frame_info[i][k].width = m_frame_info[ref_i][k].width;
					m_frame_info[i][k].height = m_frame_info[ref_i][k].height;
				} else {
					++m_directions;
				}
			}
		}
		m_directions /= m_frames_per_direction;
	}
	"""