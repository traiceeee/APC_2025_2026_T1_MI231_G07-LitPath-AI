import React from 'react';
import { Modal, Button, Rate, Tag, Input } from 'antd';
import { CheckCircleOutlined } from '@ant-design/icons';

const ReviewFeedbackModal = ({ feedback, onClose }) => {

  // Enhanced CSS styles for better responsive design
  const styles = `
    .review-feedback-modal .ant-modal-body {
      padding: 24px;
    }

    .review-feedback-content {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .single-layout-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-item {
      margin-bottom: 16px;
    }

    .form-item label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #1a1a1a;
    }

    .form-item label {
      display: block;
      margin-bottom: 8px;
      font-size: 14px;
      font-weight: 500;
      color: #1a1a1a;
    }

    .consent-status {
      display: flex;
      align-items: center;
      padding: 8px 12px;
      background-color: #e6f7ef;
      border: 1px solid #b3e5fc;
      border-radius: 4px;
      color: #52c41a;
      font-size: 14px;
    }

    .client-profile {
      background-color: #ffffff;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      padding: 12px;
    }

    .profile-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
    }

    .profile-row .label {
      font-weight: 500;
      color: #1a1a1a;
    }

    .profile-row .value {
      color: #4a4a4a;
      word-break: break-word;
    }

    .feedback-evaluation {
      background-color: #ffffff;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      padding: 12px;
    }

    .rating {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .rating .label {
      margin-right: 8px;
      font-weight: 500;
    }

    .rating-text {
      margin-left: 8px;
      color: #4a4a4a;
    }

    .research-interests {
      margin-top: 8px;
    }

    .research-interests .label {
      margin-bottom: 8px;
      font-weight: 500;
    }

    .interests-list {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .ant-tag {
      font-size: 12px;
    }

    .ant-input {
      width: 100%;
      padding: 8px 12px;
      border: 1px solid #d9d9d9;
      border-radius: 4px;
      transition: border-color 0.3s ease;
    }

    .ant-input:focus {
      border-color: #1890ff;
      box-shadow: 0 0 0 2px rgba(24, 144, 255, 0.2);
    }

    .ant-tag {
      font-size: 12px;
    }

    /* Enhanced responsive styles */
    @media (max-width: 768px) {
      .review-feedback-modal .ant-modal-body {
        padding: 12px;
      }

      .review-feedback-content {
        gap: 12px;
      }

      .single-column-form {
        padding: 12px;
        gap: 12px;
      }

      .section {
        padding: 12px;
      }

      .section h3 {
        font-size: 15px;
        margin-bottom: 12px;
      }

      .form-item {
        margin-bottom: 12px;
      }

      .form-item label {
        font-size: 13px;
        margin-bottom: 6px;
      }

      .profile-row {
        flex-direction: column;
        gap: 4px;
      }

      .profile-row .label {
        font-size: 13px;
        margin-bottom: 2px;
      }

      .profile-row .value {
        font-size: 13px;
      }

      .rating {
        flex-direction: column;
        align-items: flex-start;
      }

      .rating .label {
        margin-right: 0;
        margin-bottom: 8px;
      }

      .rating-text {
        margin-left: 0;
      }
    }

    @media (max-width: 480px) {
      .review-feedback-modal .ant-modal-body {
        padding: 8px;
      }

      .single-column-form {
        padding: 8px;
        gap: 10px;
      }

      .section {
        padding: 10px;
      }

      .consent-status {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }

      .client-profile, .feedback-evaluation {
        padding: 8px;
      }
    }
  `;

  // Adding styles to the document head
  React.useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.textContent = styles;
    document.head.appendChild(styleElement);

    // Cleanup function to remove styles when component unmounts
    return () => {
      document.head.removeChild(styleElement);
    };
  }, []);

  return (
    <Modal
      title="Review Feedback"
      open={!!feedback} // Using !!feedback to convert to boolean
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>Cancel</Button>,
        <Button key="submit" type="primary">Submit</Button>
      ]}
      width={800}
      className="review-feedback-modal"
    >
      <div className="review-feedback-content">
        {/* Single layout form - no visual separation between sections */}
        <div className="single-layout-form">
          {/* DATA PRIVACY CONSENT */}
          <div className="form-item">
            <label>DATAPRIVACY CONSENT</label>
            <div className="consent-status">
              <CheckCircleOutlined style={{ color: '#52c41a', marginRight: 8 }} />
              Consent given
            </div>
          </div>

          {/* CLIENT PROFILE */}
          <div className="form-item">
            <label>CLIENT PROFILE</label>
            <div className="client-profile">
              <div className="profile-row">
                <span className="label">Client Type:</span>
                <span className="value">Others</span>
              </div>
              <div className="profile-row">
                <span className="label">Date of Interaction:</span>
                <span className="value">2026-04-12</span>
              </div>
              <div className="profile-row">
                <span className="label">Sex:</span>
                <span className="value">Prefer not to say</span>
              </div>
              <div className="profile-row">
                <span className="label">Age:</span>
                <span className="value">31-35</span>
              </div>
              <div className="profile-row">
                <span className="label">Region:</span>
                <span className="value">R06</span>
              </div>
              <div className="profile-row">
                <span className="label">User Category:</span>
                <span className="value">Researcher</span>
              </div>
            </div>
          </div>

          {/* FEEDBACK & EVALUATION */}
          <div className="form-item">
            <label>FEEDBACK & EVALUATION</label>
            <div className="feedback-evaluation">
              <div className="rating">
                <span className="label">LitPath AI Rating:</span>
                <Rate value={2} disabled />
                <span className="rating-text">2/5</span>
              </div>
              <div className="research-interests">
                <span className="label">Research Interests:</span>
                <div className="interests-list">
                  <Tag color="blue">Quantum Computing</Tag>
                </div>
              </div>
            </div>
          </div>

          {/* Analysis & Action Section - integrated in the same layout */}
          <div className="analysis-action-section">
            <div className="analysis-action-title">Analysis & Action</div>

            <div className="form-item">
              <label>Status *</label>
              <Tag color="gold">Pending</Tag>
            </div>

            <div className="form-item">
              <label>Category *</label>
              <Tag color="blue">Issue</Tag>
            </div>

            <div className="form-item">
              <label>Is this valid? *</label>
              <Input placeholder="Enter your assessment" />
            </div>

            <div className="form-item">
              <label>Is it doable? *</label>
              <Input placeholder="Enter your assessment" />
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default ReviewFeedbackModal;